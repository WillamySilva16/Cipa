package br.com.rs.cipa.repo;

import br.com.rs.cipa.model.Voto;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface VotoRepository extends JpaRepository<Voto, Long> {
    @Query("select v.candidato, count(v) from Voto v group by v.candidato")
    List<Object[]> contarPorCandidato();
}
