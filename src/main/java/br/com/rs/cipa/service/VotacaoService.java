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
import java.time.Duration;
import java.util.*;

@Service
public class VotacaoService {
    public static final String BRANCO = "VOTO EM BRANCO";
    private static final Duration TTL_COLABORADORES = Duration.ofMinutes(10);
    private static final Duration TTL_CANDIDATOS = Duration.ofMinutes(2);

    private final SheetsService sheets;
    private final VotanteRepository votantes;
    private final VotoRepository votos;
    private final String admId, admRange, candId, candRange, pepper;

    private volatile Map<String, Colaborador> cacheColab = Map.of();
    private volatile long colabEm = 0;
    private volatile List<Candidato> cacheCand = List.of();
    private volatile long candEm = 0;

    public VotacaoService(SheetsService sheets, VotanteRepository votantes, VotoRepository votos,
                          @Value("${cipa.admissoes.id}") String admId,
                          @Value("${cipa.admissoes.range}") String admRange,
                          @Value("${cipa.candidatos.id}") String candId,
                          @Value("${cipa.candidatos.range}") String candRange,
                          @Value("${cipa.pepper}") String pepper) {
        this.sheets = sheets; this.votantes = votantes; this.votos = votos;
        this.admId = admId; this.admRange = admRange; this.candId = candId; this.candRange = candRange;
        this.pepper = pepper;
    }

    /* ---------- planilhas (com cache curto) ---------- */

    private Map<String, Colaborador> colaboradores() throws IOException {
        if (System.currentTimeMillis() - colabEm > TTL_COLABORADORES.toMillis()) {
            Map<String, Colaborador> m = new HashMap<>();
            // intervalo B:J => 0 = CPF (B), 5 = NOME (G), 8 = CARGO (J)
            for (List<Object> r : sheets.values(admId, admRange)) {
                if (r.isEmpty()) continue;
                String cpf = CpfUtil.normaliza(r.get(0));
                if (!CpfUtil.valido(cpf)) continue;
                String nome = r.size() > 5 ? r.get(5).toString().trim() : "";
                String cargo = r.size() > 8 ? r.get(8).toString().trim() : "";
                m.putIfAbsent(cpf, new Colaborador(nome, cargo));
            }
            cacheColab = m; colabEm = System.currentTimeMillis();
        }
        return cacheColab;
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

    public ValidarResponse validar(String cpfBruto) throws IOException {
        String cpf = CpfUtil.normaliza(cpfBruto);
        if (!CpfUtil.valido(cpf)) throw new RegraException(400, "CPF inválido. Confira os números.");
        Colaborador c = colaboradores().get(cpf);
        if (c == null) throw new RegraException(404, "CPF não encontrado na base de colaboradores.");
        if (votantes.existsByCpfHash(hash(cpf))) throw new RegraException(409, "Este CPF já registrou o voto.");
        return new ValidarResponse(c.nome(), c.cargo(), candidatos());
    }

    @Transactional
    public void votar(String cpfBruto, String candidato) throws IOException {
        String cpf = CpfUtil.normaliza(cpfBruto);
        if (!CpfUtil.valido(cpf) || !colaboradores().containsKey(cpf))
            throw new RegraException(403, "CPF não autorizado.");
        boolean permitido = BRANCO.equals(candidato)
                || candidatos().stream().anyMatch(c -> c.nome().equals(candidato));
        if (!permitido) throw new RegraException(400, "Candidato inválido.");
        try {
            votantes.saveAndFlush(new Votante(hash(cpf)));   // a constraint única barra voto duplo
        } catch (DataIntegrityViolationException e) {
            throw new RegraException(409, "Este CPF já registrou o voto.");
        }
        votos.save(new Voto(candidato));
    }

    public ApuracaoResponse apuracao() throws IOException {
        Map<String, Long> m = new LinkedHashMap<>();
        candidatos().forEach(c -> m.put(c.nome(), 0L));
        m.put(BRANCO, 0L);
        for (Object[] row : votos.contarPorCandidato()) m.merge((String) row[0], (Long) row[1], Long::sum);
        List<ApuracaoItem> itens = m.entrySet().stream()
                .map(e -> new ApuracaoItem(e.getKey(), e.getValue()))
                .sorted(Comparator.comparingLong(ApuracaoItem::votos).reversed()).toList();
        return new ApuracaoResponse(votantes.count(), votos.count(), itens);
    }

    public static class RegraException extends RuntimeException {
        public final int status;
        public RegraException(int status, String msg) { super(msg); this.status = status; }
    }
}
