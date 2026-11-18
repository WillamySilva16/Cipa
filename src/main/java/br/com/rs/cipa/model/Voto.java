package br.com.rs.cipa.model;

import jakarta.persistence.*;

/** O voto em si: só o candidato, sem CPF e sem data, para manter o sigilo. */
@Entity
@Table(name = "votos")
public class Voto {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String candidato;

    protected Voto() {}
    public Voto(String candidato) { this.candidato = candidato; }
}
