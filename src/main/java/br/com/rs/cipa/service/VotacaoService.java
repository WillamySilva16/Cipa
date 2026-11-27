package br.com.rs.cipa.service;

import br.com.rs.cipa.model.*;
import br.com.rs.cipa.model.Records.*;
import br.com.rs.cipa.repo.VotanteRepository;
import br.com.rs.cipa.repo.VotoRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.*;

@Service
public class VotacaoService {
    public static final String BRANCO = "VOTO EM BRANCO";
    private static final String AMBIGUO = "*";
    private static final Duration TTL_COLABORADORES = Duration.ofMinutes(10);
    private static final Duration TTL_CANDIDATOS = Duration.ofMinutes(2);
    private static final ZoneId ZONA = ZoneId.of("America/Sao_Paulo");
    private static final DateTimeFormatter FORMATO_HUMANO = DateTimeFormatter.ofPattern("dd/MM/yyyy 'às' HH:mm");
    private static final String ALFABETO = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"; // sem 0, 1, I, L e O, que se confundem

    /** porCpf: CPF (11 dígitos) -> pessoa. reParaCpf: RE -> CPF dono do RE, ou AMBIGUO se o RE repete em empresas diferentes. */
    private record Base(Map<String, Colaborador> porCpf, Map<String, String> reParaCpf) {}

    private final SheetsService sheets;
    private final VotanteRepository votantes;
    private final VotoRepository votos;
    private final String colabId, colabRange, candId, candRange, pepper;
    private final int colCpf, colCpfAlt, colNome, colCargo, colRe;
    private final Instant encerraEm;   // opcional: a votação fecha e a apuração só abre depois desta hora
    private final SecureRandom aleatorio = new SecureRandom();

    private volatile Base cacheBase = new Base(Map.of(), Map.of());
    private volatile long colabEm = 0;
    private volatile List<Candidato> cacheCand = List.of();
    private volatile long candEm = 0;

    public VotacaoService(SheetsService sheets, VotanteRepository votantes, VotoRepository votos,
                          @Value("${cipa.colaboradores.id}") String colabId,
                          @Value("${cipa.colaboradores.range}") String colabRange,
                          @Value("${cipa.colaboradores.col-cpf}") int colCpf,
                          @Value("${cipa.colaboradores.col-cpf-alt}") int colCpfAlt,
                          @Value("${cipa.colaboradores.col-nome}") int colNome,
                          @Value("${cipa.colaboradores.col-cargo}") int colCargo,
                          @Value("${cipa.colaboradores.col-re}") int colRe,
                          @Value("${cipa.candidatos.id}") String candId,
                          @Value("${cipa.candidatos.range}") String candRange,
                          @Value("${cipa.pepper}") String pepper,
                          @Value("${cipa.encerra-em}") String encerraEm) {
        this.sheets = sheets; this.votantes = votantes; this.votos = votos;
        this.colabId = colabId; this.colabRange = colabRange; this.candId = candId; this.candRange = candRange;
        this.colCpf = colCpf; this.colCpfAlt = colCpfAlt; this.colNome = colNome; this.colCargo = colCargo; this.colRe = colRe;
        this.pepper = pepper;
        this.encerraEm = lerData(encerraEm);
    }

    private static Instant lerData(String texto) {
        if (texto == null || texto.isBlank()) return null;
        try {
            return OffsetDateTime.parse(texto.trim()).toInstant();
        } catch (DateTimeParseException e) {
            throw new IllegalStateException("VOTACAO_ENCERRA_EM inválida. Use o formato 2026-12-05T18:00:00-03:00", e);
        }
    }

    private static String texto(Instant i) {
        return DateTimeFormatter.ISO_OFFSET_DATE_TIME.format(i.atZone(ZONA));
    }

    private void exigeVotacaoAberta() {
        if (encerraEm != null && Instant.now().isAfter(encerraEm)) throw new RegraException(403, "A votação foi encerrada.");
    }

    /** Com a hora de encerramento definida, ninguém vê o placar parcial: isso evitaria descobrir o voto de alguém comparando placar e lista de quem votou. */
    private void exigeApuracaoLiberada() {
        if (encerraEm != null && Instant.now().isBefore(encerraEm))
            throw new RegraException(403, "A apuração só fica disponível depois do encerramento da votação, em "
                    + FORMATO_HUMANO.format(encerraEm.atZone(ZONA)) + ".");
    }

    private String novoProtocolo() {
        for (int tentativa = 0; tentativa < 10; tentativa++) {
            StringBuilder sb = new StringBuilder("CIPA-");
            for (int i = 0; i < 8; i++) {
                if (i == 4) sb.append('-');
                sb.append(ALFABETO.charAt(aleatorio.nextInt(ALFABETO.length())));
            }
            String protocolo = sb.toString();
            if (!votantes.existsByProtocolo(protocolo)) return protocolo;
        }
        throw new IllegalStateException("Não foi possível gerar o protocolo do comprovante.");
    }

    /* ---------- planilhas (com cache curto) ---------- */

    private Base base() throws IOException {
        if (System.currentTimeMillis() - colabEm > TTL_COLABORADORES.toMillis()) {
            Map<String, Colaborador> porCpf = new HashMap<>();
            Map<String, String> reParaCpf = new HashMap<>();
            // as posições das colunas (a partir do 0 dentro do intervalo) vêm da configuração
            for (List<Object> r : sheets.values(colabId, colabRange)) {
                String cpf = cpfDaLinha(r);
                if (!CpfUtil.valido(cpf)) continue;
                porCpf.putIfAbsent(cpf, new Colaborador(celula(r, colNome), celula(r, colCargo)));
                String re = normalizaRe(celula(r, colRe));
                if (!re.isEmpty()) reParaCpf.merge(re, cpf, (a, b) -> a.equals(b) ? a : AMBIGUO);
            }
            cacheBase = new Base(porCpf, reParaCpf);
            colabEm = System.currentTimeMillis();
        }
        return cacheBase;
    }

    private static String celula(List<Object> r, int i) {
        return i >= 0 && i < r.size() && r.get(i) != null ? r.get(i).toString().trim() : "";
    }

    /** Só dígitos e sem zeros à esquerda: "0016114" e "16114" são o mesmo RE. */
    static String normalizaRe(String s) {
        String d = s == null ? "" : s.replaceAll("\\D", "");
        return d.replaceFirst("^0+(?!$)", "");
    }

    /** Usa a coluna principal do CPF e, se ela estiver vazia ou inválida, a alternativa (que pode ter perdido zeros). */
    private String cpfDaLinha(List<Object> r) {
        String cpf = CpfUtil.normaliza(celula(r, colCpf));
        if (CpfUtil.valido(cpf)) return cpf;
        return CpfUtil.normaliza(celula(r, colCpfAlt));
    }

    public List<Candidato> candidatos() throws IOException {
        if (System.currentTimeMillis() - candEm > TTL_CANDIDATOS.toMillis()) {
            List<Candidato> l = new ArrayList<>();
            for (List<Object> r : sheets.values(candId, candRange)) {
                if (r.isEmpty() || r.get(0).toString().isBlank()) continue;
                l.add(new Candidato(r.get(0).toString().trim(), r.size() > 1 ? r.get(1).toString().trim() : ""));
            }
            cacheCand = l; candEm = System.currentTimeMillis();
        }
        return cacheCand;
    }

    /* ---------- regras ---------- */

    String hash(String cpf) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(pepper.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return HexFormat.of().formatHex(mac.doFinal(cpf.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    /**
     * Descobre quem é a pessoa a partir do que foi digitado: com 9 dígitos ou mais é CPF, com menos é RE.
     * Devolve sempre o CPF da pessoa, para que o voto seja barrado pelo mesmo hash tanto por CPF quanto por RE.
     */
    private String resolverCpf(String entrada, Base b) {
        String d = entrada == null ? "" : entrada.replaceAll("\\D", "");
        if (d.isEmpty()) throw new RegraException(400, "Informe o CPF ou o RE.");
        if (d.length() >= 9) {
            String cpf = CpfUtil.normaliza(d);
            if (!CpfUtil.valido(cpf)) throw new RegraException(400, "CPF inválido. Confira os números.");
            if (!b.porCpf().containsKey(cpf)) throw new RegraException(404, "CPF não encontrado na base de colaboradores.");
            return cpf;
        }
        String cpf = b.reParaCpf().get(normalizaRe(d));
        if (cpf == null) throw new RegraException(404, "RE não encontrado na base de colaboradores.");
        if (AMBIGUO.equals(cpf)) throw new RegraException(409, "Este RE existe em mais de uma empresa. Entre com o seu CPF.");
        return cpf;
    }

    public ValidarResponse validar(String entrada) throws IOException {
        exigeVotacaoAberta();
        Base b = base();
        String cpf = resolverCpf(entrada, b);
        Colaborador c = b.porCpf().get(cpf);
        if (votantes.existsByCpfHash(hash(cpf))) throw new RegraException(409, "Você já registrou o voto.");
        return new ValidarResponse(c.nome(), c.cargo(), candidatos());
    }

    @Transactional
    public Comprovante votar(String entrada, String candidato, String ip) throws IOException {
        exigeVotacaoAberta();
        Base b = base();
        String cpf = resolverCpf(entrada, b);
        Colaborador c = b.porCpf().get(cpf);
        boolean permitido = BRANCO.equals(candidato)
                || candidatos().stream().anyMatch(x -> x.nome().equals(candidato));
        if (!permitido) throw new RegraException(400, "Candidato inválido.");

        Votante v = new Votante(hash(cpf), novoProtocolo(), c.nome(), c.cargo(), ip);
        try {
            votantes.saveAndFlush(v);   // a constraint única barra voto duplo
        } catch (DataIntegrityViolationException e) {
            throw new RegraException(409, "Você já registrou o voto.");
        }
        votos.save(new Voto(candidato));   // sem nenhuma referência ao votante
        return new Comprovante(v.getProtocolo(), v.getNome(), v.getCargo(), texto(v.getVotadoEm()));
    }

    /** Quem votou e quando. Nunca em quem: a escolha não é guardada junto da pessoa. */
    public List<VotanteItem> listarVotantes() {
        return votantes.findAllByOrderByVotadoEmAsc().stream()
                .map(v -> new VotanteItem(v.getProtocolo(), v.getNome(), v.getCargo(), texto(v.getVotadoEm()), v.getIp()))
                .toList();
    }

    public ApuracaoResponse apuracao() throws IOException {
        exigeApuracaoLiberada();
        Map<String, String> funcoes = new HashMap<>();
        Map<String, Long> m = new LinkedHashMap<>();
        for (Candidato c : candidatos()) { funcoes.put(c.nome(), c.funcao()); m.put(c.nome(), 0L); }
        m.put(BRANCO, 0L);
        for (Object[] row : votos.contarPorCandidato()) m.merge((String) row[0], (Long) row[1], Long::sum);
        List<ApuracaoItem> itens = m.entrySet().stream()
                .map(e -> new ApuracaoItem(e.getKey(), funcoes.getOrDefault(e.getKey(), ""), e.getValue()))
                .sorted(Comparator.comparingLong(ApuracaoItem::votos).reversed()).toList();
        return new ApuracaoResponse(votantes.count(), votos.count(), itens);
    }

    public static class RegraException extends RuntimeException {
        public final int status;
        public RegraException(int status, String msg) { super(msg); this.status = status; }
    }
}
