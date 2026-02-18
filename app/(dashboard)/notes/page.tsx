'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Plus, Trash2, GripVertical } from 'lucide-react'

interface AdminTodo {
  id: string
  content: string
  completed: boolean
  sort_order: number
  created_at: string
}

export default function NotesPage() {
  const [todos, setTodos] = useState<AdminTodo[]>([])
  const [newTodo, setNewTodo] = useState('')
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingContent, setEditingContent] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const editRef = useRef<HTMLInputElement>(null)

  const supabase = createClient()

  const loadTodos = async () => {
    const { data } = await supabase
      .from('admin_todos')
      .select('*')
      .order('completed', { ascending: true })
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false })

    setTodos((data as AdminTodo[]) || [])
    setLoading(false)
  }

  useEffect(() => {
    loadTodos()
  }, [])

  useEffect(() => {
    if (editingId && editRef.current) {
      editRef.current.focus()
    }
  }, [editingId])

  const handleAdd = async () => {
    const content = newTodo.trim()
    if (!content) return

    // Get the lowest sort_order so the new item goes to the top of uncompleted
    const minOrder = todos.length > 0
      ? Math.min(...todos.filter(t => !t.completed).map(t => t.sort_order)) - 1
      : 0

    const { data, error } = await supabase
      .from('admin_todos')
      .insert({ content, sort_order: minOrder })
      .select()
      .single()

    if (!error && data) {
      setTodos((prev) => [data as AdminTodo, ...prev.filter(t => t.completed), ...prev.filter(t => !t.completed)])
      await loadTodos()
    }

    setNewTodo('')
    inputRef.current?.focus()
  }

  const handleToggle = async (id: string, completed: boolean) => {
    // Optimistic update
    setTodos((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed } : t))
    )

    const { error } = await supabase
      .from('admin_todos')
      .update({ completed })
      .eq('id', id)

    if (error) {
      // Revert on error
      setTodos((prev) =>
        prev.map((t) => (t.id === id ? { ...t, completed: !completed } : t))
      )
    } else {
      await loadTodos()
    }
  }

  const handleDelete = async (id: string) => {
    // Optimistic update
    setTodos((prev) => prev.filter((t) => t.id !== id))

    await supabase
      .from('admin_todos')
      .delete()
      .eq('id', id)
  }

  const handleStartEdit = (todo: AdminTodo) => {
    setEditingId(todo.id)
    setEditingContent(todo.content)
  }

  const handleSaveEdit = async () => {
    if (!editingId) return
    const content = editingContent.trim()
    if (!content) return

    setTodos((prev) =>
      prev.map((t) => (t.id === editingId ? { ...t, content } : t))
    )

    await supabase
      .from('admin_todos')
      .update({ content })
      .eq('id', editingId)

    setEditingId(null)
    setEditingContent('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAdd()
    }
  }

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveEdit()
    } else if (e.key === 'Escape') {
      setEditingId(null)
      setEditingContent('')
    }
  }

  const handleClearCompleted = async () => {
    const completedIds = todos.filter((t) => t.completed).map((t) => t.id)
    if (completedIds.length === 0) return

    setTodos((prev) => prev.filter((t) => !t.completed))

    await supabase
      .from('admin_todos')
      .delete()
      .in('id', completedIds)
  }

  const incompleteTodos = todos.filter((t) => !t.completed)
  const completedTodos = todos.filter((t) => t.completed)

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Notes</h1>
        <p className="text-muted-foreground">
          Feature requests, ideas, and to-dos
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          {/* Add new item */}
          <div className="flex gap-2 mb-6">
            <Input
              ref={inputRef}
              placeholder="Add a new item..."
              value={newTodo}
              onChange={(e) => setNewTodo(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1"
            />
            <Button onClick={handleAdd} disabled={!newTodo.trim()}>
              <Plus className="h-4 w-4 mr-2" />
              Add
            </Button>
          </div>

          {loading ? (
            <p className="text-muted-foreground text-center py-8">Loading...</p>
          ) : todos.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No items yet. Add one above.
            </p>
          ) : (
            <div className="space-y-1">
              {/* Incomplete items */}
              {incompleteTodos.map((todo) => (
                <div
                  key={todo.id}
                  className="flex items-center gap-3 group rounded-lg px-3 py-2 hover:bg-muted/50 transition-colors"
                >
                  <Checkbox
                    checked={false}
                    onCheckedChange={() => handleToggle(todo.id, true)}
                  />
                  {editingId === todo.id ? (
                    <Input
                      ref={editRef}
                      value={editingContent}
                      onChange={(e) => setEditingContent(e.target.value)}
                      onKeyDown={handleEditKeyDown}
                      onBlur={handleSaveEdit}
                      className="flex-1 h-8"
                    />
                  ) : (
                    <span
                      className="flex-1 cursor-pointer select-none"
                      onClick={() => handleStartEdit(todo)}
                    >
                      {todo.content}
                    </span>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 p-0"
                    onClick={() => handleDelete(todo.id)}
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              ))}

              {/* Completed items */}
              {completedTodos.length > 0 && (
                <>
                  <div className="flex items-center justify-between pt-4 pb-2">
                    <span className="text-sm text-muted-foreground font-medium">
                      Completed ({completedTodos.length})
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground h-8"
                      onClick={handleClearCompleted}
                    >
                      Clear
                    </Button>
                  </div>
                  {completedTodos.map((todo) => (
                    <div
                      key={todo.id}
                      className="flex items-center gap-3 group rounded-lg px-3 py-2 hover:bg-muted/50 transition-colors"
                    >
                      <Checkbox
                        checked={true}
                        onCheckedChange={() => handleToggle(todo.id, false)}
                      />
                      <span className="flex-1 line-through text-muted-foreground">
                        {todo.content}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 p-0"
                        onClick={() => handleDelete(todo.id)}
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
