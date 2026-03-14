export default function CrudTable({ columns, rows, onEdit, onDelete }) {
  return (
    <table className="table">
      <thead>
        <tr>
          {columns.map((c) => (
            <th key={c.key}>{c.label}</th>
          ))}
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            {columns.map((c) => (
              <td key={c.key}>{c.render ? c.render(row[c.key], row) : row[c.key]}</td>
            ))}
            <td className="action-cell">
              <button onClick={() => onEdit(row)}>編集</button>
              <button className="danger" onClick={() => onDelete(row)}>
                削除
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
