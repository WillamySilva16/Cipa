package br.com.rs.cipa.service;

import com.google.api.client.googleapis.javanet.GoogleNetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import com.google.api.services.sheets.v4.Sheets;
import com.google.api.services.sheets.v4.SheetsScopes;
import com.google.auth.http.HttpCredentialsAdapter;
import com.google.auth.oauth2.GoogleCredentials;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.List;

@Service
public class SheetsService {
    private final Sheets sheets;

    public SheetsService(@Value("${google.credentials-json}") String valor) throws Exception {
        String json = valor == null ? "" : valor.trim();
        if (json.isEmpty()) {
            throw new IllegalStateException("Defina GOOGLE_CREDENTIALS_JSON (JSON da conta de serviço, puro ou em base64).");
        }
        // aceita o JSON puro ou em base64 (base64 não sofre com aspas e quebras de linha)
        if (!json.startsWith("{")) {
            json = new String(Base64.getMimeDecoder().decode(json), StandardCharsets.UTF_8);
        }
        GoogleCredentials cred = GoogleCredentials
                .fromStream(new ByteArrayInputStream(json.getBytes(StandardCharsets.UTF_8)))
                .createScoped(List.of(SheetsScopes.SPREADSHEETS_READONLY));
        this.sheets = new Sheets.Builder(
                GoogleNetHttpTransport.newTrustedTransport(),
                GsonFactory.getDefaultInstance(),
                new HttpCredentialsAdapter(cred))
                .setApplicationName("cipa-votacao").build();
    }

    public List<List<Object>> values(String spreadsheetId, String range) throws IOException {
        var res = sheets.spreadsheets().values().get(spreadsheetId, range).execute();
        return res.getValues() == null ? List.of() : res.getValues();
    }
}
