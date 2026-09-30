#!/bin/bash

# Start the Node.js backend
echo "Starting backend server..."
cd cadovet-server
npm start &
BACKEND_PID=$!
cd ..

# Start the React frontend
echo "Starting frontend client..."
cd cadovet-client
npm run dev &
FRONTEND_PID=$!
cd ..

echo "Both systems are starting up!"
echo "Backend PID: $BACKEND_PID"
echo "Frontend PID: $FRONTEND_PID"

# Wait for both processes
wait $BACKEND_PID $FRONTEND_PID
