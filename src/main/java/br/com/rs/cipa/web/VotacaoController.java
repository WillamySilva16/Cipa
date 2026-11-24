package br.com.rs.cipa.web;

import br.com.rs.cipa.model.Records.*;
import br.com.rs.cipa.service.VotacaoService;
import br.com.rs.cipa.service.VotacaoService.RegraException;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

@RestController
@RequestMapping("/api")
public class VotacaoController {
    private final VotacaoService service;
    private final RateLimiter limiter;
    private final String adminToken;

    public VotacaoController(VotacaoService service, RateLimiter limiter,
                             @Value("${cipa.admin-token}") String adminToken) {
        this.service = service; this.limiter = limiter; this.adminToken = adminToken;
    }

    @PostMapping("/validar")
    public ValidarResponse validar(@RequestBody ValidarRequest req, HttpServletRequest http) throws IOException {
        limita(http);
        return service.validar(req.cpf());
    }

    @PostMapping("/votos")
    public ResponseEntity<Void> votar(@RequestBody VotoRequest req, HttpServletRequest http) throws IOException {
        limita(http);
        service.votar(req.cpf(), req.candidato());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/admin/apuracao")
    public ApuracaoResponse apuracao(@RequestHeader(value = "X-Admin-Token", defaultValue = "") String token,
                                     HttpServletRequest http) throws IOException {
        limita(http);
        boolean ok = !adminToken.isBlank() && MessageDigest.isEqual(
                adminToken.getBytes(StandardCharsets.UTF_8), token.getBytes(StandardCharsets.UTF_8));
        if (!ok) throw new RegraException(401, "Token inválido.");
        return service.apuracao();
    }

    private void limita(HttpServletRequest http) {
        if (!limiter.permite(http.getRemoteAddr()))
            throw new RegraException(429, "Muitas tentativas. Aguarde um minuto.");
    }

    @ExceptionHandler(RegraException.class)
    public ResponseEntity<Erro> regra(RegraException e) {
        return ResponseEntity.status(e.status).body(new Erro(e.getMessage()));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Erro> geral(Exception e) {
        e.printStackTrace();
        return ResponseEntity.status(500).body(new Erro("Erro interno. Tente novamente."));
    }
}
