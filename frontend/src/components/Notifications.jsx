export default function Notifications({ notifications }) {
  return (
    <div>
      <h3>Notificações</h3>
      {notifications.length === 0 ? <p>Sem notificações</p> : notifications.map((n,i) => (
        <div key={i} style={{ border: "1px solid #ddd", padding: 6, marginBottom: 6 }}>
          <div><strong>{n.tipo}</strong></div>
          <pre style={{ whiteSpace: "pre-wrap", fontSize: 12 }}>{JSON.stringify(n, null, 2)}</pre>
        </div>
      ))}
    </div>
  );
}
