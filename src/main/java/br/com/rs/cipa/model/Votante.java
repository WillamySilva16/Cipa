package br.com.rs.cipa.model;

import jakarta.persistence.*;
import java.time.Instant;

/** Quem já votou (só o hash do CPF). Não tem ligação com o voto. */
@Entity
@Table(name = "votantes", uniqueConstraints = @UniqueConstraint(columnNames = "cpf_hash"))
public class Votante {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "cpf_hash", nullable = false, length = 64)
    private String cpfHash;

    @Column(name = "votado_em", nullable = false)
    private Instant votadoEm = Instant.now();

    protected Votante() {}
    public Votante(String cpfHash) { this.cpfHash = cpfHash; }
}
