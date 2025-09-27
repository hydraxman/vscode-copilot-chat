# Copilot Agent Planning Workflow

## Overview

This document summarizes how Copilot agent mode plans multi-step tasks, tracks progress, and decides when to conclude a request. It captures the components you explored earlier so the flow is easy to revisit.

## Prompt-Level Planning Instructions

- `src/extension/prompts/node/agent/agentPrompt.tsx` renders the agent prompt each turn and selects the appropriate instruction set (for example `DefaultAgentPrompt`).
- `src/extension/prompts/node/agent/agentInstructions.tsx` is where the model receives explicit planning guidance: act autonomously, keep working until the request is done, and maintain a structured todo list when `manage_todo_list` is available.
- `<TodoListToolInstructions>` inside that file spells out quality rules for plans (3–7 non-trivial items, single in-progress step, immediate status updates) while `<KeepGoingReminder>` reinforces persistence and reporting style.

## Iterative Execution Loop

- `src/extension/prompt/node/defaultIntentRequestHandler.ts` prepares the chat turn, wires telemetry, and then delegates iterative work to `ToolCallingLoop`.
- `src/extension/intents/node/toolCallingLoop.ts` executes the core loop:
  - Build the prompt (which injects the planning instructions above) and determine enabled tools.
  - Send messages plus tool schemas to the model, stream responses, and capture every tool call in `toolCallRounds`.
  - Repeat until the model finishes, the user cancels, or `toolCallLimit` is reached; hitting the limit triggers a confirmation prompt (`"Continue to iterate?"`).
- Stream participants created by the handler log rendered markdown so you can inspect every chunk in the “GitHub Copilot Chat” output channel.

## Todo List Context Propagation

- `<TodoListContextPrompt>` in `src/extension/tools/node/todoListContextPrompt.tsx` runs on each turn to display the current plan inside the prompt context.
- It calls `TodoListContextProvider` (`src/extension/prompt/node/todoListContextProvider.ts`), which invokes `manage_todo_list` via `IToolsService` to fetch the latest todo JSON.
- When the model updates the plan, the tool payload is validated (Ajv schemas in `src/extension/tools/common/toolsService.ts`) and persisted so the refreshed prompt can echo the new state.
- Provider-specific agents (for example `src/extension/agents/claude/node/claudeCodeAgent.ts`) translate their planning output into the same core tool shape, keeping the experience consistent.

## Completion Safeguards and Metadata

- The loop returns a `IToolCallLoopResult`; when `maxToolCallsExceeded` is set, the handler marks the metadata so the UI can inform the user and offer to continue.
- `InteractionOutcomeComputer` and other response processors track whether edits survived, giving downstream features reliable status.
- Logging hooks you added earlier continue to emit `_logService` telemetry for both submitted prompts and the streamed markdown.

## Sequence Diagram

```mermaid
sequenceDiagram
    participant U as User
    participant Handler as DefaultIntentRequestHandler
    participant Loop as ToolCallingLoop
    participant Prompt as AgentPrompt
    participant TodoPrompt as TodoListContextPrompt
    participant TodoProvider as TodoListContextProvider
    participant Tools as IToolsService
    participant Model
    U->>Handler: Submit chat request
    Handler->>Loop: run()
    Loop->>Prompt: buildPrompt()
    Prompt->>TodoPrompt: render(todoList)
    TodoPrompt->>TodoProvider: getCurrentTodoContext(sessionId)
    TodoProvider->>Tools: invoke(manage_todo_list, read)
    Tools-->>TodoProvider: serialized todo data
    TodoProvider-->>TodoPrompt: formatted plan snapshot
    Prompt-->>Loop: System + user messages
    Loop->>Model: send prompt + tool schema
    Model-->>Loop: natural language + tool calls
    alt Model issues plan update
        Loop->>Tools: invoke(manage_todo_list, write)
        Tools-->>Loop: confirmation content
    end
    Loop-->>Handler: response + toolCallRounds
    Handler-->>U: Streamed reply and logs
    Loop-->>Prompt: persist tool results for next round
```
