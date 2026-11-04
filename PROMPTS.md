# Prompts

This project was built with [Claude Code](https://claude.com/claude-code), using the Claude Opus 5.5 model. These are my prompts, word for word. The only thing removed is the personal greeting and scheduling text from the email.

## 1. The brief

> I have to build this application, I will paste the requirements, let us plan it before the go ahead, for the git repo we will use my github https://github.com/pietromezzadri, the requirements are
>
> Objective
> Build a full-stack calculator application with a React frontend and a backend microservice. The frontend should consume the backend API to perform basic and advanced arithmetic operations. Focus on clean design, maintainable code, and testable architecture.Requirements
> Functional
> Operations:
>
> * Addition, Subtraction, Multiplication, Division
> * Optional: Exponentiation, Square Root, Percentage
>
> Frontend (React):
>
> * Intuitive UI for entering input and displaying results
> * Input validation and error handling
> * Responsive design (basic mobile support)
>
> Backend (REST API):
>
> * Expose endpoints for calculator operations
> * Validate input and handle edge cases (division by zero, invalid data)
> * Return results in JSON format
>
> Non-Functional
>
> * Clean, readable, and idiomatic code (frontend and backend)
> * Unit tests covering key functionality for both layers
> * Documentation: setup instructions, API usage, and design rationale
> * Optional: Dockerfile for full-stack deployment
>
> Constraints
>
> * Frontend: React (TypeScript preferred)
> * Backend: Go is perferred
>
> Deliverables
>
> 1. Git repository with frontend and backend code
> 2. README with setup instructions, API examples, and design decisions
> 3. Unit tests and coverage report
> 4. Optional: Dockerfile to run frontend + backend together
>
> Instructions
>
> 1. Use any AI tooling you would like
> 2. Spend ~2–4 hours on this assignment. Prioritize correctness, clarity, and maintainability over extra features.
> 3. Push your solution to GitHub, GitLab, or another Git repository.
> 4. Share the repository link with us for evaluation.
> 5. Share any prompts that you used in your work
> 6. Make sure your README includes:
>    * Setup instructions
>    * How to run the frontend and backend
>    * Examples of API calls (if using REST)
>    * Design decisions or assumptions

## 2. Planning decisions

Claude asked these questions before planning. My answers:

| Question | My answer |
|---|---|
| How should the backend handle numbers? Plain float64 makes 0.1 + 0.2 return 0.30000000000000004. | Decimal |
| What should the frontend look like? | Classic keypad |
| Which optional items should be included? | Extra operations, Docker, GitHub Actions CI |
| What should the repo be called, and who can see it? | simple-calculator, public |

## 3. Plan approval

Claude then wrote an implementation plan, which I reviewed and approved. It built the project from that plan and stopped for my review before publishing.

## 4. Testing the Docker image

Docker Desktop wasn't running when Claude reached the image test, so it asked me to start it.

> Docker is running

## 5. Publishing

Claude asked whether to publish, and which email the commits should use.

> Publish with Gmail

GitHub rejected the first push because my login lacked permission to upload workflow files. I granted it with `gh auth refresh` and replied:

> Done, push again

## 6. README additions

> add a screenshot of the app to the readme and add a status badge based on the CI runs and coverage if possible

## 7. Theme toggle, copy and paste

> while we wait for that, let us allow the user to toggle between dark and light theme, also to copy and paste values into the calculator

Claude asked before pushing these changes.

> Yes, push
