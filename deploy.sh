set -e 

NAME="chat-app"
USERNAME="omaralmgosh"
IMAGE="$USERNAME/$NAME-image:latest"

echo "Building Docker image ..."
docker compose -f Docker/docker-compose.yml -f Docker/docker-compose.prod.yml build

echo "Edit the image tag"
docker image tag $IMAGE $USERNAME/$NAME-image:prod
docker image rm $IMAGE -f
docker image ls

echo "Pushing image to Docker Hub..."
docker image push $USERNAME/$NAME-image:prod

echo "Applying kubernetes manifests..."
kubectl apply -f ./k8s

echo "Getting pods..."
kubectl get pods 

echo "Getting services..."
kubectl get services

echo "Fetching the main service"
kubectl get services $NAME-service