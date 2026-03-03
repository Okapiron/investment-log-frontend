export default function CrudTable({ columns, rows, onEdit, onDelete }) {
  return (
    <table className="table">
      <thead>
        <tr>
          {columns.map((c) => (
            <th key={c.key}>{c.label}</th>
          ))}
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            {columns.map((c) => (
              <td key={c.key}>{c.render ? c.render(row[c.key], row) : row[c.key]}</td>
            ))}
            <td className="action-cell">
              <button onClick={() => onEdit(row)}>Edit</button>
              <button className="danger" onClick={() => onDelete(row)}>
                Delete
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
