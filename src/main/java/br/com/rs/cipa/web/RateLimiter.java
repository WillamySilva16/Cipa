package br.com.rs.cipa.web;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.concurrent.ConcurrentHashMap;

/**
 * Limite simples por IP, para dificultar varredura de CPFs. O padrao e 120 chamadas por minuto, porque na
 * rede da empresa muita gente sai pelo mesmo IP (cada voto usa 2 chamadas). Ajuste com LIMITE_POR_MINUTO.
 */
@Component
public class RateLimiter {
    private record Janela(long inicio, int n) {}
    private final ConcurrentHashMap<String, Janela> mapa = new ConcurrentHashMap<>();
    private final int limite;

    public RateLimiter(@Value("${cipa.limite-por-minuto}") int limite) {
        this.limite = limite;
    }

    public boolean permite(String ip) {
        long agora = System.currentTimeMillis();
        Janela j = mapa.merge(ip, new Janela(agora, 1),
                (a, b) -> agora - a.inicio() > 60_000 ? b : new Janela(a.inicio(), a.n() + 1));
        if (mapa.size() > 10_000) mapa.entrySet().removeIf(e -> agora - e.getValue().inicio() > 60_000);
        return j.n() <= limite;
    }
}
