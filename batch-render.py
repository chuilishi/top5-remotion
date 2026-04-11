import os, sys, subprocess, msvcrt

ROOT = os.path.dirname(os.path.abspath(__file__))
PROJECTS_DIR = os.path.join(ROOT, "projects")


def get_projects_sorted_by_time():
    if not os.path.isdir(PROJECTS_DIR):
        return []
    result = []
    for d in os.listdir(PROJECTS_DIR):
        yaml_path = os.path.join(PROJECTS_DIR, d, "project.yaml")
        if os.path.isdir(os.path.join(PROJECTS_DIR, d)) and os.path.isfile(yaml_path):
            result.append((d, os.path.getmtime(yaml_path)))
    result.sort(key=lambda x: x[1], reverse=True)
    return [r[0] for r in result]


def get_current_project():
    f = os.path.join(ROOT, ".current-project")
    if os.path.isfile(f):
        return open(f, "r", encoding="utf-8").read().strip()
    return None


def clear_screen():
    os.system("cls")


def multi_select(projects):
    current = get_current_project()
    cursor = 0
    selected = set()

    def render():
        clear_screen()
        print("批量渲染 (↑↓ 移动, Space 选择/取消, a 全选, Enter 确认, q 退出)\n")
        for i, p in enumerate(projects):
            check = "\033[32m✔\033[0m" if i in selected else " "
            mark = " \033[33m(current)\033[0m" if p == current else ""
            prefix = "\033[36m❯\033[0m" if i == cursor else " "
            name = f"\033[36m{p}\033[0m" if i == cursor else p
            print(f"  {prefix} [{check}] {name}{mark}")
        print(f"\n  已选择: {len(selected)} 个项目")

    render()

    while True:
        key = msvcrt.getwch()
        if key == "\xe0" or key == "\x00":
            arrow = msvcrt.getwch()
            if arrow == "H":
                cursor = (cursor - 1) % len(projects)
            elif arrow == "P":
                cursor = (cursor + 1) % len(projects)
            render()
        elif key == " ":
            if cursor in selected:
                selected.discard(cursor)
            else:
                selected.add(cursor)
            render()
        elif key == "a":
            if len(selected) == len(projects):
                selected.clear()
            else:
                selected.update(range(len(projects)))
            render()
        elif key == "\r":
            print()
            return [projects[i] for i in sorted(selected)]
        elif key == "q" or key == "\x03":
            print("\nCancelled.")
            sys.exit(0)


def main():
    projects = get_projects_sorted_by_time()
    if not projects:
        print("No projects found.")
        sys.exit(0)

    chosen = multi_select(projects)
    if not chosen:
        print("No projects selected.")
        sys.exit(0)

    print(f"\n将按顺序渲染 {len(chosen)} 个项目:\n")
    for i, p in enumerate(chosen, 1):
        print(f"  {i}. {p}")
    print()

    results = []

    for i, project in enumerate(chosen, 1):
        sep = "=" * 60
        print(f"\n{sep}\n[{i}/{len(chosen)}] 渲染: {project}\n{sep}\n")

        with open(os.path.join(ROOT, ".current-project"), "w", encoding="utf-8") as f:
            f.write(project)

        try:
            subprocess.run(
                ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "render-top5.ps1"],
                cwd=ROOT, check=True,
            )
            results.append((project, "✔ 成功"))
        except subprocess.CalledProcessError:
            results.append((project, "✘ 失败"))
            print(f"\n[{project}] 渲染失败，继续下一个...\n")

    print(f"\n{sep}")
    print("批量渲染完成\n")
    for i, (p, status) in enumerate(results, 1):
        print(f"  {i}. {p} — {status}")
    print()


if __name__ == "__main__":
    main()
