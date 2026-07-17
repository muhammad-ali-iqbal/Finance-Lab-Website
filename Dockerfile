FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html logo.png Car-1.jpg Car-2.jpg Car-3.jpg /usr/share/nginx/html/
