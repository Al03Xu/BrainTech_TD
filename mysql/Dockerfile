# Image database sendiri: MySQL resmi + skema awal ikut di dalam image.
# init.sql otomatis dijalankan saat volume data masih kosong (pertama kali start).
FROM mysql:8.4

COPY init.sql /docker-entrypoint-initdb.d/01-init.sql

EXPOSE 3306
