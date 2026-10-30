import { useEffect, useState, type CSSProperties, type DragEvent } from 'react'
import { IconButton, PageHeading } from '../components/bits'
import Icon from '../components/Icon'
import { useStore } from '../data/store'
import { taskColours, updateTask } from '../data/tasks'
import { useUI } from '../hooks/useUI'
import { fmt, shift, todayKey } from '../lib/dates'
import type { Task } from '../lib/types'

const minutes = (time: string) => { const [h, m] = time.split(':').map(Number); return h * 60 + m }
const clock = (minute: number) => `${String(Math.floor(minute / 60) % 24).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`
const SCALE = 1.5
const CARD_HEIGHT = 122

// Allocate separate lanes using visible card bounds, including short tasks.
function timelineLayout(tasks: Task[]) {
  const sorted = [...tasks].sort((a,b) => minutes(a.time)-minutes(b.time) || a.id.localeCompare(b.id))
  const result: { task: Task; start: number; end: number; lane: number; lanes: number }[] = []
  let group: typeof result = [], laneEnds: number[] = [], groupEnd = -1
  const finish = () => { group.forEach(item => { item.lanes = laneEnds.length }); group = []; laneEnds = [] }
  for (const task of sorted) {
    const start = minutes(task.time), end = start + Math.max(task.estimate, CARD_HEIGHT / SCALE)
    if (start >= groupEnd) finish()
    let lane = laneEnds.findIndex(end => end <= start)
    if (lane === -1) lane = laneEnds.length
    laneEnds[lane] = end
    const item = { task, start, end, lane, lanes: 1 }
    result.push(item); group.push(item); groupEnd = Math.max(...laneEnds)
  }
  finish()
  return result
}

export default function DayCalendar() {
  const { uid, tasks, projects } = useStore()
  const { open, toast } = useUI()
  const [selected, setSelected] = useState(todayKey)
  const [now, setNow] = useState(() => new Date())
  const [dragOver, setDragOver] = useState<number | null>(null)
  useEffect(() => { const interval = window.setInterval(() => setNow(new Date()), 30000); return () => window.clearInterval(interval) }, [])
  const today = todayKey()
  const weekday = (new Date(`${selected}T12:00:00`).getDay() + 6) % 7
  const dates = Array.from({length: 7}, (_, i) => shift(selected, i - weekday))
  const dayTasks = tasks.filter(t => t.date === selected)
  const timed = dayTasks.filter(t => t.time)
  const anytime = dayTasks.filter(t => !t.time)
  const layout = timelineLayout(timed)
  const startHour = Math.min(7, ...timed.map(t => Math.floor(minutes(t.time)/60)))
  const endHour = Math.min(24, Math.max(21, ...timed.map(t => Math.ceil((minutes(t.time)+t.estimate)/60))))
  const height = Math.max((endHour-startHour)*60*SCALE, ...layout.map(t => (t.end-startHour*60)*SCALE+12))
  const lanes = Math.max(1, ...layout.map(t => t.lanes))
  const currentMinute = now.getHours()*60+now.getMinutes()
  const add = (time = '') => open({kind:'task',id:null,defaults:{date:selected,time}})

  async function drop(event: DragEvent, minute: number) {
    event.preventDefault(); setDragOver(null)
    const task = tasks.find(t => t.id === event.dataTransfer.getData('text/plain'))
    if (!task) return
    try { await updateTask(uid,task,{date:selected,time:clock(minute)},`Rescheduled to ${selected} ${clock(minute)}`); toast('A little space, replanned.') }
    catch { toast('Could not move this task. Please try again.') }
  }

  return <>
    <PageHeading eyebrow="YOUR DAY, AT YOUR PACE" title="Task calendar" sub="A little structure. A little room to breathe." actions={<button className="btn" onClick={()=>setSelected(today)}>Today</button>} />
    <section className="day-planner" aria-label="Daily task calendar">
      <div className="day-month-bar">
        <div><h2>{fmt(selected,{month:'long',year:'numeric'})}</h2><p>{fmt(selected,{weekday:'long',day:'numeric',month:'short'})}</p></div>
        <div className="row"><IconButton label="Previous week" icon="chevron" style={{transform:'rotate(180deg)'}} onClick={()=>setSelected(shift(selected,-7))}/><IconButton label="Next week" icon="chevron" onClick={()=>setSelected(shift(selected,7))}/></div>
      </div>
      <div className="day-date-strip" aria-label="Choose a day">
        {dates.map(date=><button key={date} className={`day-date ${date===selected?'selected':''}`} aria-pressed={date===selected} aria-label={fmt(date,{weekday:'long',day:'numeric',month:'long'})} onClick={()=>setSelected(date)}>
          <strong>{Number(date.slice(-2))}</strong><span>{fmt(date,{weekday:'short'})}</span><i className={tasks.some(t=>t.date===date)?'has-tasks':''}/>
        </button>)}
      </div>
      <div className="day-summary"><span>{dayTasks.length} {dayTasks.length===1?'intention':'intentions'} <span aria-hidden="true">·</span> {timed.reduce((n,t)=>n+t.estimate,0)} min planned</span><span>{dayTasks.filter(t=>t.status==='done').length} complete</span></div>
      {anytime.length>0 && <div className="day-anytime"><span className="eyebrow">ANY TIME</span><div>{anytime.map(t=><button key={t.id} onClick={()=>open({kind:'task',id:t.id})}><Icon name={t.status==='done'?'check':'inbox'}/>{t.title}</button>)}</div></div>}
      {!dayTasks.length && <div className="day-empty"><Icon name="sun"/><div><h3>A little room for possibility.</h3><p>Tap a time below to plan your first task.</p></div></div>}
      <div className="day-timeline-scroll" aria-label="Scroll through your day" tabIndex={0}>
        <div className="day-timeline" style={{height, minWidth:lanes>2?60+lanes*135:undefined}}>
          {Array.from({length:endHour-startHour},(_,i)=>startHour+i).map(hour=><div className="day-hour" key={hour} style={{top:(hour-startHour)*60*SCALE,height:60*SCALE}}>
            <span className="day-hour-label">{hour%12||12}<small>{hour<12?'am':'pm'}</small></span>
            {[0,30].map(minute=><button key={minute} className={`day-slot ${dragOver===hour*60+minute?'drag-over':''}`} style={{top:minute*SCALE,height:30*SCALE}} aria-label={`Add task at ${clock(hour*60+minute)}`} onClick={()=>add(clock(hour*60+minute))} onDragOver={e=>{e.preventDefault();setDragOver(hour*60+minute)}} onDragLeave={()=>setDragOver(null)} onDrop={e=>drop(e,hour*60+minute)}/>)}
          </div>)}
          <div className="day-events">
            {layout.map(({task,start,end,lane,lanes})=>{
              const accent = task.colour?taskColours[task.colour]:'var(--pink)'
              return <button key={task.id} className={`day-event ${task.status==='done'?'completed':''}`} style={{'--event-accent':accent,top:(start-startHour*60)*SCALE,height:(end-start)*SCALE-10,left:`calc(${lane/lanes*100}% + 5px)`,width:`calc(${100/lanes}% - 14px)`} as CSSProperties} draggable onDragStart={e=>{e.dataTransfer.setData('text/plain',task.id);e.dataTransfer.effectAllowed='move'}} onClick={()=>open({kind:'task',id:task.id})}>
                <span className="day-event-project">{projects.find(p=>p.id===task.projectId)?.name||'Personal'}{task.status==='done'&&<Icon name="check"/>}</span>
                <strong>{task.title}</strong>
                <span className="day-event-time"><Icon name="clock"/>{task.time} – {clock(start+task.estimate)}{start+task.estimate>=1440?' (+1 day)':''}</span>
              </button>
            })}
          </div>
          {selected===today && currentMinute>=startHour*60 && currentMinute<endHour*60 && <div className="day-now" style={{top:(currentMinute-startHour*60)*SCALE}} aria-label={`Current time ${clock(currentMinute)}`}><i/><span>{clock(currentMinute)}</span></div>}
        </div>
      </div>
      <div className="day-planner-footer"><span>Make space for what matters.</span><button className="day-add" aria-label="Add task on selected day" onClick={()=>add()}><Icon name="plus"/></button><span className="day-edit-hint">Tap a task to edit</span></div>
    </section>
  </>
}
