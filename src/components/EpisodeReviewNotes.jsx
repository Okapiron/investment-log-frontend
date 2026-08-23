import { useEffect, useRef } from 'react'

function AutoGrowTextArea({ title, value, onChange, placeholder }) {
  const ref = useRef(null)

  useEffect(() => {
    const element = ref.current
    if (!element) return
    element.style.height = 'auto'
    element.style.height = `${Math.max(150, element.scrollHeight)}px`
  }, [value])

  return (
    <label className="v2-review-note-field">
      <span>{title}</span>
      <textarea
        ref={ref}
        value={value || ''}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={5}
      />
    </label>
  )
}

export default function EpisodeReviewNotes({ review, onChange, aiDraft }) {
  const draftItems = aiDraft && typeof aiDraft === 'object'
    ? Object.values(aiDraft).filter((item) => typeof item === 'string' && item.trim())
    : []

  return (
    <section className="v2-review-notes">
      <div className="v2-review-notes-heading">
        <div>
          <div style={{ fontSize: 12, color: '#2a8871', fontWeight: 900 }}>REVIEW NOTES</div>
          <h2 style={{ margin: '3px 0 0', fontSize: 19, color: '#101828' }}>チャートを見て言語化する</h2>
        </div>
        <div style={{ color: '#667085', fontSize: 12 }}>入力内容は自動保存されます</div>
      </div>

      {draftItems.length ? (
        <div className="v2-ai-draft">
          <strong>AI下書き</strong>
          <ul>{draftItems.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul>
        </div>
      ) : null}

      <AutoGrowTextArea
        title="学び"
        value={review?.learning_note || ''}
        onChange={(value) => onChange('learning_note', value)}
        placeholder="客観的に何が起きたか。買い・売り判断の良かった点、悪かった点を思うまま書く"
      />
      <AutoGrowTextArea
        title="次回どうするか"
        value={review?.next_action_note || ''}
        onChange={(value) => onChange('next_action_note', value)}
        placeholder="次に同じ形が来たとき、何を確認し、どう判断するかを書く"
      />
    </section>
  )
}
