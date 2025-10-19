# Relay-r


## Local-Setup
### setting up github webhooks for testing the application
*gh webhook forward --repo=OWNER_NAME/REPO_NAME --events=push,pull_request --url=URL_OF_API_ENDPOINT_TO_HANDLE_WEBHOOK*
Ex: gh webhook forward --repo=sarthakmadhamshettiwar/backend-dev --events=push,pull_request --url=http://localhost:3000/webhook/github