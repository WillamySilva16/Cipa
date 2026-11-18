package br.com.rs.cipa.service;

public final class CpfUtil {
    private CpfUtil() {}

    /** Só dígitos, com zeros à esquerda recompostos (a planilha pode ter perdido). Vazio se não houver dígitos. */
    public static String normaliza(Object bruto) {
        if (bruto == null) return "";
        String d = bruto.toString().replaceAll("\\D", "");
        if (d.isEmpty() || d.length() > 11) return d;
        return "0".repeat(11 - d.length()) + d;
    }

    public static boolean valido(String cpf) {
        if (cpf == null || !cpf.matches("\\d{11}") || cpf.matches("(\\d)\\1{10}")) return false;
        for (int t = 9; t < 11; t++) {
            int soma = 0;
            for (int i = 0; i < t; i++) soma += (cpf.charAt(i) - '0') * (t + 1 - i);
            int dv = ((soma * 10) % 11) % 10;
            if (dv != cpf.charAt(t) - '0') return false;
        }
        return true;
    }
}
