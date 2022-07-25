FROM cimg/node:16.14.2
USER circleci
RUN mkdir -p /home/circleci/app
WORKDIR /home/circleci/app
COPY --chown=circleci:circleci package*.json ./
COPY --chown=circleci:circleci src ./src
RUN npm install
CMD [ "npm", "start" ]
