package br.com.rs.cipa.model;

import jakarta.persistence.*;

import java.util.concurrent.ThreadLocalRandom;

/**
 * O voto em si: só o candidato, sem CPF, sem nome e sem data. O id é sorteado (e não sequencial)
 * para a ordem dos votos não permitir casar um voto com a lista de quem votou.
 */
@Entity
@Table(name = "votos")
public class Voto {
    @Id
    private Long id;

    @Column(nullable = false)
    private String candidato;

    protected Voto() {}

    public Voto(String candidato) {
        this.id = ThreadLocalRandom.current().nextLong(1L, Long.MAX_VALUE);
        this.candidato = candidato;
    }
}
