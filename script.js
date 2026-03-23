(function () {
  "use strict";

  var tasks = Array.isArray(window.ROADMAP_TASKS) ? window.ROADMAP_TASKS.slice() : [];

  var appState = {
    selectedMonth: "",
    selectedTaskId: "",
    filters: {
      assignee: "all",
      stream: "all",
      status: "all",
      search: ""
    }
  };

  var dom = {};

  function parseDate(value) {
    var parts = String(value || "").split("-");

    if (parts.length !== 3) {
      return null;
    }

    var year = Number(parts[0]);
    var monthIndex = Number(parts[1]) - 1;
    var day = Number(parts[2]);
    var date = new Date(year, monthIndex, day);

    if (Number.isNaN(date.getTime())) {
      return null;
    }

    return date;
  }

  function toIsoDate(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
      return "";
    }

    var year = date.getFullYear();
    var month = String(date.getMonth() + 1).padStart(2, "0");
    var day = String(date.getDate()).padStart(2, "0");

    return year + "-" + month + "-" + day;
  }

  function toMonthKey(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
      return "";
    }

    var year = date.getFullYear();
    var month = String(date.getMonth() + 1).padStart(2, "0");

    return year + "-" + month;
  }

  function getMonthLabel(monthKey) {
    var parts = String(monthKey || "").split("-");

    if (parts.length !== 2) {
      return "";
    }

    var year = Number(parts[0]);
    var monthIndex = Number(parts[1]) - 1;
    var date = new Date(year, monthIndex, 1);

    return date.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric"
    });
  }

  function getMonthRange(monthKey) {
    var parts = String(monthKey || "").split("-");

    if (parts.length !== 2) {
      return null;
    }

    var year = Number(parts[0]);
    var monthIndex = Number(parts[1]) - 1;
    var start = new Date(year, monthIndex, 1);
    var end = new Date(year, monthIndex + 1, 0);

    return {
      start: start,
      end: end
    };
  }

  function buildWeekRangesForMonth(monthKey) {
    var monthRange = getMonthRange(monthKey);

    if (!monthRange) {
      return [];
    }

    var cursor = new Date(monthRange.start.getFullYear(), monthRange.start.getMonth(), monthRange.start.getDate());
    var weeks = [];

    while (cursor <= monthRange.end) {
      var weekStart = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate());
      var weekEnd = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 6);

      if (weekEnd > monthRange.end) {
        weekEnd = new Date(monthRange.end.getFullYear(), monthRange.end.getMonth(), monthRange.end.getDate());
      }

      weeks.push({
        label: toIsoDate(weekStart) + " to " + toIsoDate(weekEnd),
        start: weekStart,
        end: weekEnd
      });

      cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 7);
    }

    return weeks;
  }

  function taskOverlapsMonth(task, monthKey) {
    var monthRange = getMonthRange(monthKey);
    var startDate = parseDate(task.startDate);
    var endDate = parseDate(task.endDate);

    if (!monthRange || !startDate || !endDate) {
      return false;
    }

    return startDate <= monthRange.end && endDate >= monthRange.start;
  }

  function filterTasksByMonth(taskList, monthKey) {
    return taskList.filter(function (task) {
      return taskOverlapsMonth(task, monthKey);
    });
  }

  function filterTasks(taskList, filters) {
    var normalizedSearch = String(filters.search || "").trim().toLowerCase();

    return taskList.filter(function (task) {
      var matchesAssignee = filters.assignee === "all" || task.assignee === filters.assignee;
      var matchesStream = filters.stream === "all" || task.stream === filters.stream;
      var matchesStatus = filters.status === "all" || task.status === filters.status;
      var searchableText = [
        task.title,
        task.assignee,
        task.role,
        task.stream,
        task.initiative,
        task.objective,
        task.notes
      ]
        .join(" ")
        .toLowerCase();
      var matchesSearch = !normalizedSearch || searchableText.indexOf(normalizedSearch) !== -1;

      return matchesAssignee && matchesStream && matchesStatus && matchesSearch;
    });
  }

  function getUniqueValues(taskList, key) {
    var seen = {};

    taskList.forEach(function (task) {
      seen[task[key]] = true;
    });

    return Object.keys(seen).sort();
  }

  function getMonthKeys(taskList) {
    var keys = {};

    taskList.forEach(function (task) {
      var startDate = parseDate(task.startDate);
      var endDate = parseDate(task.endDate);

      if (!startDate || !endDate) {
        return;
      }

      var cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
      var limit = new Date(endDate.getFullYear(), endDate.getMonth(), 1);

      while (cursor <= limit) {
        keys[toMonthKey(cursor)] = true;
        cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
      }
    });

    return Object.keys(keys).sort();
  }

  function getVisibleTasks() {
    var monthTasks = filterTasksByMonth(tasks, appState.selectedMonth);
    return filterTasks(monthTasks, appState.filters);
  }

  function getSelectedTask(visibleTasks) {
    var selectedTask = visibleTasks.find(function (task) {
      return task.id === appState.selectedTaskId;
    });

    if (selectedTask) {
      return selectedTask;
    }

    return visibleTasks[0] || null;
  }

  function syncSelectedTask(visibleTasks) {
    var selectedTask = getSelectedTask(visibleTasks);
    appState.selectedTaskId = selectedTask ? selectedTask.id : "";
  }

  function createOptionMarkup(value, label, isSelected) {
    return (
      '<option value="' +
      escapeHtml(value) +
      '"' +
      (isSelected ? " selected" : "") +
      ">" +
      escapeHtml(label) +
      "</option>"
    );
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function renderHeader(visibleTasks) {
    dom.headerDebug.innerHTML =
      '<p class="muted">Current month: <strong>' +
      escapeHtml(getMonthLabel(appState.selectedMonth)) +
      "</strong></p>" +
      '<p class="muted">Visible tasks: <strong>' +
      String(visibleTasks.length) +
      "</strong></p>";
  }

  function renderFilters() {
    var assignees = getUniqueValues(tasks, "assignee");
    var streams = getUniqueValues(tasks, "stream");
    var statuses = getUniqueValues(tasks, "status");

    var assigneeOptions = [createOptionMarkup("all", "All assignees", appState.filters.assignee === "all")]
      .concat(
        assignees.map(function (value) {
          return createOptionMarkup(value, value, value === appState.filters.assignee);
        })
      )
      .join("");

    var streamOptions = [createOptionMarkup("all", "All streams", appState.filters.stream === "all")]
      .concat(
        streams.map(function (value) {
          return createOptionMarkup(value, value, value === appState.filters.stream);
        })
      )
      .join("");

    var statusOptions = [createOptionMarkup("all", "All statuses", appState.filters.status === "all")]
      .concat(
        statuses.map(function (value) {
          return createOptionMarkup(value, value, value === appState.filters.status);
        })
      )
      .join("");

    dom.filtersRoot.innerHTML =
      '<form class="filters-grid" id="filters-form">' +
      '<label class="field"><span>Assignee</span><select name="assignee">' +
      assigneeOptions +
      "</select></label>" +
      '<label class="field"><span>Stream</span><select name="stream">' +
      streamOptions +
      "</select></label>" +
      '<label class="field"><span>Status</span><select name="status">' +
      statusOptions +
      "</select></label>" +
      '<label class="field"><span>Search</span><input type="search" name="search" value="' +
      escapeHtml(appState.filters.search) +
      '" placeholder="Search title, notes, initiative" /></label>' +
      "</form>";
  }

  function renderMonthNavigation() {
    var monthKeys = getMonthKeys(tasks);

    dom.monthNavigationRoot.innerHTML =
      '<div class="month-list">' +
      monthKeys
        .map(function (monthKey) {
          return (
            '<button class="month-button" type="button" data-month-key="' +
            escapeHtml(monthKey) +
            '" aria-pressed="' +
            String(monthKey === appState.selectedMonth) +
            '">' +
            escapeHtml(getMonthLabel(monthKey)) +
            "</button>"
          );
        })
        .join("") +
      "</div>";
  }

  function renderRoadmap(visibleTasks) {
    var weekRanges = buildWeekRangesForMonth(appState.selectedMonth);

    if (!visibleTasks.length) {
      dom.roadmapRoot.innerHTML =
        '<p class="muted">No tasks match the selected month and filters.</p>' +
        '<div class="week-list">' +
        weekRanges
          .map(function (week) {
            return '<div class="pill">' + escapeHtml(week.label) + "</div>";
          })
          .join("") +
        "</div>";
      return;
    }

    dom.roadmapRoot.innerHTML =
      '<div class="debug-meta"><p>Weeks in month</p></div>' +
      '<div class="week-list">' +
      weekRanges
        .map(function (week) {
          return '<div class="pill">' + escapeHtml(week.label) + "</div>";
        })
        .join("") +
      "</div>" +
      '<hr />' +
      '<div class="task-list">' +
      visibleTasks
        .map(function (task) {
          var isSelected = task.id === appState.selectedTaskId;

          return (
            '<article class="task-card' +
            (isSelected ? " is-selected" : "") +
            '" data-task-id="' +
            escapeHtml(task.id) +
            '">' +
            '<div class="task-title-row"><strong>' +
            escapeHtml(task.title) +
            "</strong><span>" +
            escapeHtml(task.status) +
            "</span></div>" +
            '<div class="task-meta-row"><span>' +
            escapeHtml(task.assignee) +
            "</span><span>" +
            escapeHtml(task.stream) +
            "</span></div>" +
            '<div class="pill-row"><span class="pill">' +
            escapeHtml(task.taskType) +
            '</span><span class="pill">' +
            escapeHtml(task.startDate) +
            " to " +
            escapeHtml(task.endDate) +
            "</span></div>" +
            '<pre class="code-block">' +
            escapeHtml(
              JSON.stringify(
                {
                  id: task.id,
                  initiative: task.initiative,
                  objective: task.objective
                },
                null,
                2
              )
            ) +
            "</pre>" +
            "</article>"
          );
        })
        .join("") +
      "</div>";
  }

  function renderDetails(visibleTasks) {
    var selectedTask = getSelectedTask(visibleTasks);

    if (!selectedTask) {
      dom.detailsRoot.innerHTML = '<p class="muted">No task selected.</p>';
      return;
    }

    dom.detailsRoot.innerHTML =
      '<div class="details-list">' +
      '<p><strong>ID:</strong> ' +
      escapeHtml(selectedTask.id) +
      "</p>" +
      '<p><strong>Title:</strong> ' +
      escapeHtml(selectedTask.title) +
      "</p>" +
      '<p><strong>Assignee:</strong> ' +
      escapeHtml(selectedTask.assignee) +
      " (" +
      escapeHtml(selectedTask.role) +
      ")</p>" +
      '<p><strong>Initiative:</strong> ' +
      escapeHtml(selectedTask.initiative) +
      "</p>" +
      '<p><strong>Objective:</strong> ' +
      escapeHtml(selectedTask.objective) +
      "</p>" +
      '<p><strong>Dates:</strong> ' +
      escapeHtml(selectedTask.startDate) +
      " to " +
      escapeHtml(selectedTask.endDate) +
      "</p>" +
      '<p><strong>Type:</strong> ' +
      escapeHtml(selectedTask.taskType) +
      "</p>" +
      '<p><strong>Notes:</strong> ' +
      escapeHtml(selectedTask.notes) +
      "</p>" +
      '<p><strong>Jira:</strong> <a href="' +
      escapeHtml(selectedTask.jiraUrl) +
      '" target="_blank" rel="noreferrer">Open ticket</a></p>' +
      "</div>";
  }

  function renderCapacity(visibleTasks) {
    var capacityByAssignee = {};

    visibleTasks.forEach(function (task) {
      if (!capacityByAssignee[task.assignee]) {
        capacityByAssignee[task.assignee] = {
          assignee: task.assignee,
          role: task.role,
          count: 0
        };
      }

      capacityByAssignee[task.assignee].count += 1;
    });

    var rows = Object.keys(capacityByAssignee)
      .sort()
      .map(function (key) {
        return capacityByAssignee[key];
      });

    if (!rows.length) {
      dom.capacityRoot.innerHTML = '<p class="muted">No visible workload in this month.</p>';
      return;
    }

    dom.capacityRoot.innerHTML =
      '<div class="capacity-list">' +
      rows
        .map(function (item) {
          return (
            "<div>" +
            "<strong>" +
            escapeHtml(item.assignee) +
            "</strong>" +
            "<p class=\"muted\">" +
            escapeHtml(item.role) +
            " | Visible tasks: " +
            String(item.count) +
            "</p>" +
            "</div>"
          );
        })
        .join("") +
      "</div>";
  }

  function render() {
    var visibleTasks = getVisibleTasks();
    syncSelectedTask(visibleTasks);
    renderHeader(visibleTasks);
    renderFilters();
    renderMonthNavigation();
    renderRoadmap(visibleTasks);
    renderDetails(visibleTasks);
    renderCapacity(visibleTasks);
  }

  function handleFilterChange(event) {
    var target = event.target;

    if (!target || !target.name) {
      return;
    }

    appState.filters[target.name] = target.value;
    render();
  }

  function handleMonthClick(event) {
    var button = event.target.closest("[data-month-key]");

    if (!button) {
      return;
    }

    appState.selectedMonth = button.getAttribute("data-month-key") || appState.selectedMonth;
    render();
  }

  function handleTaskClick(event) {
    var taskCard = event.target.closest("[data-task-id]");

    if (!taskCard) {
      return;
    }

    appState.selectedTaskId = taskCard.getAttribute("data-task-id") || "";
    render();
  }

  function bindEvents() {
    dom.filtersRoot.addEventListener("input", handleFilterChange);
    dom.filtersRoot.addEventListener("change", handleFilterChange);
    dom.monthNavigationRoot.addEventListener("click", handleMonthClick);
    dom.roadmapRoot.addEventListener("click", handleTaskClick);
  }

  function cacheDom() {
    dom.headerDebug = document.getElementById("header-debug");
    dom.filtersRoot = document.getElementById("filters-root");
    dom.monthNavigationRoot = document.getElementById("month-navigation-root");
    dom.roadmapRoot = document.getElementById("roadmap-root");
    dom.detailsRoot = document.getElementById("details-root");
    dom.capacityRoot = document.getElementById("capacity-root");
  }

  function initializeState() {
    var monthKeys = getMonthKeys(tasks);
    var currentMonthKey = toMonthKey(new Date());
    appState.selectedMonth = monthKeys.indexOf(currentMonthKey) !== -1 ? currentMonthKey : monthKeys[0] || "";
    appState.selectedTaskId = "";
  }

  function init() {
    cacheDom();
    initializeState();
    bindEvents();
    render();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
