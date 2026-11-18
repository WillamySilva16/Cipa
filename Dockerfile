# 1) build do front
FROM node:20-slim AS front
WORKDIR /front
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# 2) build do back (com o front dentro de static/)
FROM maven:3.9-eclipse-temurin-17 AS back
WORKDIR /app
COPY pom.xml ./
RUN mvn -q -B dependency:go-offline
COPY src ./src
COPY --from=front /front/dist ./src/main/resources/static
RUN mvn -q -B package -DskipTests

# 3) imagem final
FROM eclipse-temurin:17-jre
WORKDIR /app
COPY --from=back /app/target/app.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
