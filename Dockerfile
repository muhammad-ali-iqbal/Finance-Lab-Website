FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html /usr/share/nginx/html/
COPY admin.html /usr/share/nginx/html/
COPY favicon.ico /usr/share/nginx/html/
COPY assets/images /usr/share/nginx/html/assets/images
