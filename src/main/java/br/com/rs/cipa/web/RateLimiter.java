package br.com.rs.cipa.web;

import org.springframework.stereotype.Component;

import java.util.concurrent.ConcurrentHashMap;

/** Limite simples por IP: 30 tentativas por minuto, para dificultar varredura de CPFs. */
@Component
public class RateLimiter {
    private record Janela(long inicio, int n) {}
    private final ConcurrentHashMap<String, Janela> mapa = new ConcurrentHashMap<>();

    public boolean permite(String ip) {
        long agora = System.currentTimeMillis();
        Janela j = mapa.merge(ip, new Janela(agora, 1),
                (a, b) -> agora - a.inicio() > 60_000 ? b : new Janela(a.inicio(), a.n() + 1));
        if (mapa.size() > 10_000) mapa.entrySet().removeIf(e -> agora - e.getValue().inicio() > 60_000);
        return j.n() <= 30;
    }
}
