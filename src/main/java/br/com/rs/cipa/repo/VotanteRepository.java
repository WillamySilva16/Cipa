package br.com.rs.cipa.repo;

import br.com.rs.cipa.model.Votante;
import org.springframework.data.jpa.repository.JpaRepository;

public interface VotanteRepository extends JpaRepository<Votante, Long> {
    boolean existsByCpfHash(String cpfHash);
}
