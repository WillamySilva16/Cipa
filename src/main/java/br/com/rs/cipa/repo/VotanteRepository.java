package br.com.rs.cipa.repo;

import br.com.rs.cipa.model.Votante;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface VotanteRepository extends JpaRepository<Votante, Long> {
    boolean existsByCpfHash(String cpfHash);
    boolean existsByProtocolo(String protocolo);
    List<Votante> findAllByOrderByVotadoEmAsc();
}
