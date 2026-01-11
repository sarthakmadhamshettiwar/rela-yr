# Relay-r


## Local-Setup
### setting up github webhooks for testing the application

*gh webhook forward --repo=OWNER_NAME/REPO_NAME --events=push,pull_request --url=URL_OF_API_ENDPOINT_TO_HANDLE_WEBHOOK*

Ex: gh webhook forward --repo=sarthakmadhamshettiwar/backend-dev --events=push,pull_request --url=http://localhost:3000/webhook/github


### Setup
1. node 20


### How to start the service
1. **starting the services**
  a. start the **producer-service** `npm tsx-node producer-service/server.ts`
  b. similarly start the **consumer-service**
  c. start the github webhook forwarder
