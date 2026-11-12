export function broadcastMarketUpdate(clients, payload) {
  const message = JSON.stringify(payload);
  clients.forEach((client) => {
    if (client.readyState === 1 && typeof client.send === 'function') client.send(message);
  });
}
