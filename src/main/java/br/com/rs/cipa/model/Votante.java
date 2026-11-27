package br.com.rs.cipa.model;

import jakarta.persistence.*;
import java.time.Instant;

/**
 * Quem já votou: hash do CPF (barra voto duplo), protocolo do comprovante, nome, cargo e hora.
 * Não existe nenhuma ligação entre esta tabela e a tabela de votos, para o voto continuar secreto.
 */
@Entity
@Table(name = "votantes", uniqueConstraints = {
        @UniqueConstraint(columnNames = "cpf_hash"),
        @UniqueConstraint(columnNames = "protocolo")
})
public class Votante {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "cpf_hash", nullable = false, length = 64)
    private String cpfHash;

    @Column(name = "votado_em", nullable = false)
    private Instant votadoEm = Instant.now();

    @Column(length = 24)
    private String protocolo;

    @Column(length = 200)
    private String nome;

    @Column(length = 200)
    private String cargo;

    /** IP de quem votou. Fica aqui, na lista de quem votou, e nunca junto do voto. */
    @Column(length = 64)
    private String ip;

    protected Votante() {}

    public Votante(String cpfHash, String protocolo, String nome, String cargo, String ip) {
        this.ip = ip;
        this.cpfHash = cpfHash;
        this.protocolo = protocolo;
        this.nome = nome;
        this.cargo = cargo;
    }

    public String getProtocolo() { return protocolo; }
    public String getNome() { return nome; }
    public String getCargo() { return cargo; }
    public String getIp() { return ip; }
    public Instant getVotadoEm() { return votadoEm; }
}
