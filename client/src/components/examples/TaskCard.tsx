import { TaskCard } from "../TaskCard";

export default function TaskCardExample() {
  const tasks = [
    {
      id: "1",
      title: "Review project proposal from client",
      description: "Check the attached documents and provide feedback by EOD",
      type: "gmail" as const,
      priority: "high" as const,
      completed: false,
      dueDate: new Date(Date.now() + 86400000),
      createdAt: new Date(),
    },
    {
      id: "2",
      title: "Follow up with Sarah about meeting",
      type: "whatsapp" as const,
      priority: "medium" as const,
      completed: false,
      createdAt: new Date(),
    },
    {
      id: "3",
      title: "Submit monthly report",
      description: "Compile data from last month and prepare the quarterly summary",
      type: "reminder" as const,
      priority: "low" as const,
      completed: true,
      createdAt: new Date(),
    },
  ];

  return (
    <div className="grid gap-4 p-4 max-w-2xl">
      {tasks.map((task) => (
        <TaskCard
          key={task.id}
          task={task}
          onToggle={(id) => console.log("Toggle task:", id)}
          onDelete={(id) => console.log("Delete task:", id)}
        />
      ))}
    </div>
  );
}
