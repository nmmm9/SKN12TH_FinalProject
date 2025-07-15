import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
  SortableContext as SortableContextType,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface Task {
  id: string;
  title: string;
  description: string;
  assignee: string;
  dueDate: string;
  priority: 'high' | 'medium' | 'low';
}

interface Column {
  id: string;
  title: string;
  tasks: Task[];
}

const TaskCard: React.FC<{ task: Task; isDragging?: boolean }> = ({ task, isDragging }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging || isSortableDragging ? 0.5 : 1,
  };

  const priorityColors = {
    high: 'border-red-500 bg-red-50',
    medium: 'border-yellow-500 bg-yellow-50',
    low: 'border-green-500 bg-green-50',
  };

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`p-3 mb-3 bg-white rounded-lg shadow-sm border-l-4 cursor-grab hover:shadow-md transition-shadow ${priorityColors[task.priority]}`}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      layout
    >
      <h4 className="font-semibold text-gray-800 mb-1">{task.title}</h4>
      <p className="text-sm text-gray-600 mb-2">{task.description}</p>
      <div className="flex justify-between items-center text-xs text-gray-500">
        <span>담당자: {task.assignee}</span>
        <span>마감: {task.dueDate}</span>
      </div>
    </motion.div>
  );
};

const KanbanColumn: React.FC<{ column: Column }> = ({ column }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: column.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const columnColors = {
    todo: 'bg-blue-100 border-blue-300',
    'in-progress': 'bg-yellow-100 border-yellow-300',
    completed: 'bg-green-100 border-green-300',
  };

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      className={`min-h-[500px] w-80 p-4 rounded-lg border-2 ${columnColors[column.id as keyof typeof columnColors] || 'bg-gray-100 border-gray-300'}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-lg text-gray-800">{column.title}</h3>
        <span className="bg-gray-200 text-gray-700 px-2 py-1 rounded-full text-sm">
          {column.tasks.length}
        </span>
      </div>
      
      <SortableContext items={column.tasks.map(task => task.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {column.tasks.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </div>
      </SortableContext>
    </motion.div>
  );
};

const KanbanBoard: React.FC = () => {
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [columns, setColumns] = useState<Column[]>([
    {
      id: 'todo',
      title: '예약된 일',
      tasks: [
        {
          id: '1',
          title: 'UI 디자인 리뷰',
          description: '새로운 대시보드 UI 디자인 검토 및 피드백',
          assignee: '김개발',
          dueDate: '2024-01-20',
          priority: 'high',
        },
        {
          id: '2',
          title: 'API 문서 작성',
          description: 'REST API 엔드포인트 문서화',
          assignee: '박백엔드',
          dueDate: '2024-01-22',
          priority: 'medium',
        },
      ],
    },
    {
      id: 'in-progress',
      title: '진행중',
      tasks: [
        {
          id: '3',
          title: '데이터베이스 최적화',
          description: '쿼리 성능 개선 및 인덱스 추가',
          assignee: '이디비',
          dueDate: '2024-01-25',
          priority: 'high',
        },
        {
          id: '4',
          title: '테스트 코드 작성',
          description: '단위 테스트 및 통합 테스트 코드 추가',
          assignee: '최테스트',
          dueDate: '2024-01-28',
          priority: 'medium',
        },
      ],
    },
    {
      id: 'completed',
      title: '완료',
      tasks: [
        {
          id: '5',
          title: '로그인 기능 구현',
          description: 'JWT 기반 사용자 인증 시스템 구현',
          assignee: '김개발',
          dueDate: '2024-01-15',
          priority: 'high',
        },
        {
          id: '6',
          title: '초기 환경 설정',
          description: '프로젝트 초기 설정 및 개발 환경 구축',
          assignee: '박설정',
          dueDate: '2024-01-10',
          priority: 'low',
        },
      ],
    },
  ]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const task = findTaskById(active.id as string);
    setActiveTask(task);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const activeTaskId = active.id as string;
    const overContainerId = over.id as string;

    const activeTask = findTaskById(activeTaskId);
    const activeColumnId = findColumnByTaskId(activeTaskId);

    if (!activeTask || !activeColumnId) return;

    // 같은 컬럼 내에서 순서 변경
    if (activeColumnId === overContainerId) {
      const column = columns.find(col => col.id === activeColumnId);
      if (!column) return;

      const oldIndex = column.tasks.findIndex(task => task.id === activeTaskId);
      const newIndex = column.tasks.findIndex(task => task.id === over.id);

      if (oldIndex !== newIndex) {
        const newTasks = arrayMove(column.tasks, oldIndex, newIndex);
        setColumns(prev => prev.map(col => 
          col.id === activeColumnId ? { ...col, tasks: newTasks } : col
        ));
      }
    } else {
      // 다른 컬럼으로 이동
      const targetColumn = columns.find(col => col.id === overContainerId);
      if (!targetColumn) return;

      setColumns(prev => {
        const newColumns = prev.map(col => {
          if (col.id === activeColumnId) {
            return {
              ...col,
              tasks: col.tasks.filter(task => task.id !== activeTaskId)
            };
          }
          if (col.id === overContainerId) {
            return {
              ...col,
              tasks: [...col.tasks, activeTask]
            };
          }
          return col;
        });
        return newColumns;
      });
    }
  };

  const findTaskById = (taskId: string): Task | null => {
    for (const column of columns) {
      const task = column.tasks.find(task => task.id === taskId);
      if (task) return task;
    }
    return null;
  };

  const findColumnByTaskId = (taskId: string): string | null => {
    for (const column of columns) {
      if (column.tasks.some(task => task.id === taskId)) {
        return column.id;
      }
    }
    return null;
  };

  return (
    <div className="p-6">
      <motion.h2 
        className="text-2xl font-bold text-gray-800 mb-6"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        📋 업무 칸반보드
      </motion.h2>
      
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-6 overflow-x-auto pb-4">
          <SortableContext items={columns.map(col => col.id)} strategy={verticalListSortingStrategy}>
            {columns.map((column) => (
              <KanbanColumn key={column.id} column={column} />
            ))}
          </SortableContext>
        </div>

        <DragOverlay>
          {activeTask ? <TaskCard task={activeTask} isDragging /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
};

export default KanbanBoard;