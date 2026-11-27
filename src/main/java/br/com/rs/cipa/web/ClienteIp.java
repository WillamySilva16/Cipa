package br.com.rs.cipa.web;

import jakarta.servlet.http.HttpServletRequest;

/**
 * IP real de quem acessa. Atras do Railway o endereco da conexao e o do proxy do Railway; a borda dele
 * grava o IP do cliente em X-Real-IP (e descarta qualquer copia enviada pelo cliente).
 */
final class ClienteIp {
    private ClienteIp() {}

    static String de(HttpServletRequest req) {
        String ip = req.getHeader("X-Real-IP");
        if (ip == null || ip.isBlank()) ip = req.getRemoteAddr();
        ip = ip == null ? "" : ip.trim();
        return ip.length() > 64 ? ip.substring(0, 64) : ip;
    }
}
