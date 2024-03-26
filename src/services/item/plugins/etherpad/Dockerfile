FROM etherpad/etherpad:1.9.7

# pass the secret key with the correct format ([a-f\d]{64}) as argument
ARG secret_key=<secret-api-key>

# make sure that the path is up to date
RUN echo $secret_key > /opt/etherpad-lite/APIKEY.txt