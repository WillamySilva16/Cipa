package br.com.rs.cipa.model;

import java.util.List;

public final class Records {
    private Records() {}

    public record Colaborador(String nome, String cargo) {}
    public record Candidato(String nome, String funcao) {}

    public record ValidarRequest(String cpf) {}
    public record ValidarResponse(String nome, String cargo, List<Candidato> candidatos) {}
    public record VotoRequest(String cpf, String candidato) {}

    /** Prova de que a pessoa votou. Nunca traz o candidato escolhido. */
    public record Comprovante(String protocolo, String nome, String cargo, String votadoEm) {}
    /** Linha da lista de participação: quem votou e quando, sem a escolha. */
    public record VotanteItem(String protocolo, String nome, String cargo, String votadoEm) {}

    public record ApuracaoItem(String candidato, String funcao, long votos) {}
    public record ApuracaoResponse(long totalVotantes, long totalVotos, List<ApuracaoItem> itens) {}
    public record Erro(String erro) {}
}
