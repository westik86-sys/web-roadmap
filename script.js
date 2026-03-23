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

    return String(date.getFullYear()) + "-" + String(date.getMonth() + 1).padStart(2, "0");
  }

  function getMonthLabel(monthKey) {
    var parts = String(monthKey || "").split("-");

    if (parts.length !== 2) {
      return "";
    }

    var date = new Date(Number(parts[0]), Number(parts[1]) - 1, 1);

    return date.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric"
    });
  }

  function formatShortDate(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
      return "";
    }

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric"
    });
  }

  function getMonthRange(monthKey) {
    var parts = String(monthKey || "").split("-");

    if (parts.length !== 2) {
      return null;
    }

    var year = Number(parts[0]);
    var monthIndex = Number(parts[1]) - 1;

    return {
      start: new Date(year, monthIndex, 1),
      end: new Date(year, monthIndex + 1, 0)
    };
  }

  function buildWeekRangesForMonth(monthKey) {
    var monthRange = getMonthRange(monthKey);
    var weeks = [];

    if (!monthRange) {
      return weeks;
    }

    var cursor = new Date(monthRange.start.getFullYear(), monthRange.start.getMonth(), monthRange.start.getDate());

    while (cursor <= monthRange.end) {
      var weekStart = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate());
      var weekEnd = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 6);

      if (weekEnd > monthRange.end) {
        weekEnd = new Date(monthRange.end.getFullYear(), monthRange.end.getMonth(), monthRange.end.getDate());
      }

      weeks.push({
        index: weeks.length,
        start: weekStart,
        end: weekEnd,
        key: toIsoDate(weekStart),
        label: formatShortDate(weekStart) + " - " + formatShortDate(weekEnd)
      });

      cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 7);
    }

    return weeks;
  }

  function buildMonthTimeline(monthKey) {
    var monthRange = getMonthRange(monthKey);
    var weeks = buildWeekRangesForMonth(monthKey);

    if (!monthRange) {
      return null;
    }

    return {
      monthKey: monthKey,
      monthLabel: getMonthLabel(monthKey),
      start: monthRange.start,
      end: monthRange.end,
      weeks: weeks,
      weekCount: weeks.length
    };
  }

  function getMonthKeys(taskList) {
    var seen = {};

    taskList.forEach(function (task) {
      var startDate = parseDate(task.startDate);
      var endDate = parseDate(task.endDate);

      if (!startDate || !endDate) {
        return;
      }

      var cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
      var limit = new Date(endDate.getFullYear(), endDate.getMonth(), 1);

      while (cursor <= limit) {
        seen[toMonthKey(cursor)] = true;
        cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
      }
    });

    return Object.keys(seen).sort();
  }

  function getUniqueValues(taskList, key) {
    var values = {};

    taskList.forEach(function (task) {
      values[task[key]] = true;
    });

    return Object.keys(values).sort();
  }

  function filterTasks(taskList, filters) {
    var searchValue = String(filters.search || "").trim().toLowerCase();

    return taskList.filter(function (task) {
      var matchesAssignee = filters.assignee === "all" || task.assignee === filters.assignee;
      var matchesStream = filters.stream === "all" || task.stream === filters.stream;
      var matchesStatus = filters.status === "all" || task.status === filters.status;
      var searchableText = [
        task.title,
        task.assignee,
        task.stream,
        task.initiative,
        task.objective
      ]
        .join(" ")
        .toLowerCase();
      var matchesSearch = !searchValue || searchableText.indexOf(searchValue) !== -1;

      return matchesAssignee && matchesStream && matchesStatus && matchesSearch;
    });
  }

  function overlapsRange(startDate, endDate, rangeStart, rangeEnd) {
    return startDate <= rangeEnd && endDate >= rangeStart;
  }

  function findWeekIndexForDate(date, weeks, fallbackToLast) {
    var index = weeks.findIndex(function (week) {
      return date >= week.start && date <= week.end;
    });

    if (index !== -1) {
      return index;
    }

    return fallbackToLast ? weeks.length - 1 : 0;
  }

  function buildTaskTimelineItem(task, timeline) {
    var startDate = parseDate(task.startDate);
    var endDate = parseDate(task.endDate);
    var belongsToMonth = !!(
      timeline &&
      startDate &&
      endDate &&
      overlapsRange(startDate, endDate, timeline.start, timeline.end)
    );

    if (!belongsToMonth) {
      return {
        task: task,
        belongsToMonth: false
      };
    }

    var visibleStart = startDate < timeline.start ? timeline.start : startDate;
    var visibleEnd = endDate > timeline.end ? timeline.end : endDate;
    var startWeekIndex = findWeekIndexForDate(visibleStart, timeline.weeks, false);
    var endWeekIndex = findWeekIndexForDate(visibleEnd, timeline.weeks, true);
    var span = endWeekIndex - startWeekIndex + 1;

    return {
      task: task,
      belongsToMonth: true,
      startsBeforeMonth: startDate < timeline.start,
      endsAfterMonth: endDate > timeline.end,
      overlapsPartially: startDate < timeline.start || endDate > timeline.end,
      originalStartDate: startDate,
      originalEndDate: endDate,
      visibleStartDate: visibleStart,
      visibleEndDate: visibleEnd,
      startWeekIndex: startWeekIndex,
      endWeekIndex: endWeekIndex,
      span: span
    };
  }

  function buildVisibleTaskTimelineItems(taskList, timeline) {
    return filterTasks(taskList, appState.filters)
      .map(function (task) {
        return buildTaskTimelineItem(task, timeline);
      })
      .filter(function (item) {
        return item.belongsToMonth;
      });
  }

  function sortTaskTimelineItems(items) {
    return items.slice().sort(function (left, right) {
      if (left.startWeekIndex !== right.startWeekIndex) {
        return left.startWeekIndex - right.startWeekIndex;
      }

      if (left.endWeekIndex !== right.endWeekIndex) {
        return left.endWeekIndex - right.endWeekIndex;
      }

      return left.task.title.localeCompare(right.task.title);
    });
  }

  function assignTaskLanes(items) {
    var laneEndIndexes = [];

    return sortTaskTimelineItems(items).map(function (item) {
      var laneIndex = laneEndIndexes.findIndex(function (endWeekIndex) {
        return item.startWeekIndex > endWeekIndex;
      });

      if (laneIndex === -1) {
        laneIndex = laneEndIndexes.length;
        laneEndIndexes.push(item.endWeekIndex);
      } else {
        laneEndIndexes[laneIndex] = item.endWeekIndex;
      }

      item.laneIndex = laneIndex;
      item.gridColumnStart = item.startWeekIndex + 1;
      item.gridColumnEnd = item.endWeekIndex + 2;
      return item;
    });
  }

  function groupTimelineRowsByAssignee(items) {
    var rowsByAssignee = {};

    items.forEach(function (item) {
      if (!rowsByAssignee[item.task.assignee]) {
        rowsByAssignee[item.task.assignee] = {
          assignee: item.task.assignee,
          role: item.task.role,
          items: []
        };
      }

      rowsByAssignee[item.task.assignee].items.push(item);
    });

    return Object.keys(rowsByAssignee)
      .sort()
      .map(function (assignee) {
        var row = rowsByAssignee[assignee];
        row.items = assignTaskLanes(row.items);
        row.laneCount = row.items.reduce(function (maxValue, item) {
          return Math.max(maxValue, item.laneIndex + 1);
        }, 0);
        return row;
      });
  }

  function getSelectedTaskItem(items) {
    return (
      items.find(function (item) {
        return item.task.id === appState.selectedTaskId;
      }) || null
    );
  }

  function hasSelectedTask(items) {
    return items.some(function (item) {
      return item.task.id === appState.selectedTaskId;
    });
  }

  function syncSelectedTask(items) {
    if (!hasSelectedTask(items)) {
      appState.selectedTaskId = "";
    }
  }

  function getSummaryMetrics(items, capacityData) {
    var assigneeSet = {};
    var streamSet = {};
    var overloadedCount = 0;

    items.forEach(function (item) {
      assigneeSet[item.task.assignee] = true;
      streamSet[item.task.stream] = true;
    });

    capacityData.forEach(function (member) {
      if (member.loadStatus === "Overloaded") {
        overloadedCount += 1;
      }
    });

    return {
      visibleTaskCount: items.length,
      assigneeCount: Object.keys(assigneeSet).length,
      streamCount: Object.keys(streamSet).length,
      overloadedCount: overloadedCount
    };
  }

  function getLoadStatus(activeTaskCount) {
    if (activeTaskCount >= 4) {
      return "Overloaded";
    }

    if (activeTaskCount === 3) {
      return "Warning";
    }

    return "OK";
  }

  function calculateWeeklyOverlapSignal(items, weekCount) {
    var overlapByWeek = [];
    var maxConcurrentTasks = 0;

    for (var weekIndex = 0; weekIndex < weekCount; weekIndex += 1) {
      var activeCount = items.reduce(function (count, item) {
        var isActiveInWeek = item.startWeekIndex <= weekIndex && item.endWeekIndex >= weekIndex;
        return count + (isActiveInWeek ? 1 : 0);
      }, 0);

      overlapByWeek.push(activeCount);
      maxConcurrentTasks = Math.max(maxConcurrentTasks, activeCount);
    }

    var overlappingWeekCount = overlapByWeek.filter(function (count) {
      return count > 1;
    }).length;

    return {
      maxConcurrentTasks: maxConcurrentTasks,
      overlappingWeekCount: overlappingWeekCount,
      hasOverlap: overlappingWeekCount > 0
    };
  }

  function buildCapacityData(items, timeline) {
    if (!timeline) {
      return [];
    }

    var membersByAssignee = {};

    items.forEach(function (item) {
      if (!membersByAssignee[item.task.assignee]) {
        membersByAssignee[item.task.assignee] = {
          assignee: item.task.assignee,
          role: item.task.role,
          items: []
        };
      }

      membersByAssignee[item.task.assignee].items.push(item);
    });

    return Object.keys(membersByAssignee)
      .sort()
      .map(function (assignee) {
        var member = membersByAssignee[assignee];
        var overlapSignal = calculateWeeklyOverlapSignal(member.items, timeline.weekCount);
        var activeTaskCount = member.items.length;

        return {
          assignee: member.assignee,
          role: member.role,
          activeTaskCount: activeTaskCount,
          loadStatus: getLoadStatus(activeTaskCount),
          overlappingWeekCount: overlapSignal.overlappingWeekCount,
          maxConcurrentTasks: overlapSignal.maxConcurrentTasks,
          hasOverlap: overlapSignal.hasOverlap
        };
      });
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
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

  function toToken(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function renderEmptyState(title, description) {
    return (
      '<div class="empty-state">' +
      '<strong class="empty-state-title">' +
      escapeHtml(title) +
      "</strong>" +
      '<p class="empty-state-description">' +
      escapeHtml(description) +
      "</p>" +
      "</div>"
    );
  }

  function renderHeader(timeline, metrics) {
    dom.headerDebug.innerHTML =
      '<div class="header-metrics">' +
      '<div class="header-metric"><span class="header-metric-label">Current month</span><strong>' +
      escapeHtml(timeline.monthLabel) +
      "</strong></div>" +
      '<div class="header-metric"><span class="header-metric-label">Visible tasks</span><strong>' +
      String(metrics.visibleTaskCount) +
      "</strong></div>" +
      '<div class="header-metric"><span class="header-metric-label">Assignees</span><strong>' +
      String(metrics.assigneeCount) +
      "</strong></div>" +
      '<div class="header-metric"><span class="header-metric-label">Streams</span><strong>' +
      String(metrics.streamCount) +
      "</strong></div>" +
      '<div class="header-metric"><span class="header-metric-label">Overloaded</span><strong>' +
      String(metrics.overloadedCount) +
      "</strong></div>" +
      "</div>";
  }

  function renderFilters() {
    var assignees = getUniqueValues(tasks, "assignee");
    var streams = getUniqueValues(tasks, "stream");
    var statuses = getUniqueValues(tasks, "status");

    dom.filtersRoot.innerHTML =
      '<form class="filters-grid">' +
      '<label class="field"><span>Assignee</span><select name="assignee">' +
      [createOptionMarkup("all", "All assignees", appState.filters.assignee === "all")]
        .concat(
          assignees.map(function (value) {
            return createOptionMarkup(value, value, appState.filters.assignee === value);
          })
        )
        .join("") +
      "</select></label>" +
      '<label class="field"><span>Stream</span><select name="stream">' +
      [createOptionMarkup("all", "All streams", appState.filters.stream === "all")]
        .concat(
          streams.map(function (value) {
            return createOptionMarkup(value, value, appState.filters.stream === value);
          })
        )
        .join("") +
      "</select></label>" +
      '<label class="field"><span>Status</span><select name="status">' +
      [createOptionMarkup("all", "All statuses", appState.filters.status === "all")]
        .concat(
          statuses.map(function (value) {
            return createOptionMarkup(value, value, appState.filters.status === value);
          })
        )
        .join("") +
      "</select></label>" +
      '<label class="field"><span>Search</span><input type="search" name="search" value="' +
      escapeHtml(appState.filters.search) +
      '" placeholder="Search title, assignee, stream, initiative" /></label>' +
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

  function renderRoadmap(timeline, rows) {
    if (!window.RoadmapTimeline || typeof window.RoadmapTimeline.render !== "function") {
      dom.roadmapRoot.innerHTML = renderEmptyState(
        "Timeline component unavailable",
        "Check that timeline.js is loaded correctly before rendering the roadmap."
      );
      return;
    }

    var summaryLabel =
      "Week columns: " +
      String(timeline ? timeline.weekCount : 0) +
      " | Timeline: " +
      formatShortDate(timeline ? timeline.start : null) +
      " - " +
      formatShortDate(timeline ? timeline.end : null);

    dom.roadmapRoot.innerHTML = window.RoadmapTimeline.render({
      timeline: timeline,
      rows: rows,
      selectedTaskId: appState.selectedTaskId,
      summaryLabel: summaryLabel
    });
  }

  function renderDetails(items) {
    var selectedItem = getSelectedTaskItem(items);

    if (!selectedItem) {
      dom.detailsRoot.innerHTML = renderEmptyState(
        "No task selected",
        "Select any task bar in the roadmap to inspect timing, ownership, and context."
      );
      return;
    }

    dom.detailsRoot.innerHTML =
      '<div class="details-list">' +
      '<section class="details-group">' +
      '<p class="details-group-label">Task</p>' +
      '<div class="details-field details-field--emphasis"><span class="details-label">Title</span><strong>' +
      escapeHtml(selectedItem.task.title) +
      "</strong></div>" +
      '<div class="details-field"><span class="details-label">ID</span><span>' +
      escapeHtml(selectedItem.task.id) +
      "</span></div>" +
      '<div class="details-field"><span class="details-label">Status</span><span class="details-status details-status--' +
      escapeHtml(toToken(selectedItem.task.status)) +
      '">' +
      escapeHtml(selectedItem.task.status) +
      "</span></div>" +
      "</section>" +
      '<section class="details-group">' +
      '<p class="details-group-label">Ownership</p>' +
      '<div class="details-field"><span class="details-label">Assignee</span><span>' +
      escapeHtml(selectedItem.task.assignee) +
      "</span></div>" +
      '<div class="details-field"><span class="details-label">Role</span><span>' +
      escapeHtml(selectedItem.task.role) +
      "</span></div>" +
      '<div class="details-field"><span class="details-label">Stream</span><span>' +
      escapeHtml(selectedItem.task.stream) +
      "</span></div>" +
      "</section>" +
      '<section class="details-group">' +
      '<p class="details-group-label">Timeline</p>' +
      '<div class="details-field"><span class="details-label">Visible Range</span><span>' +
      escapeHtml(toIsoDate(selectedItem.visibleStartDate)) +
      " to " +
      escapeHtml(toIsoDate(selectedItem.visibleEndDate)) +
      "</span></div>" +
      '<div class="details-field"><span class="details-label">Original Range</span><span>' +
      escapeHtml(selectedItem.task.startDate) +
      " to " +
      escapeHtml(selectedItem.task.endDate) +
      "</span></div>" +
      '<div class="details-field"><span class="details-label">Week Placement</span><span>W' +
      String(selectedItem.startWeekIndex + 1) +
      " to W" +
      String(selectedItem.endWeekIndex + 1) +
      " | span " +
      String(selectedItem.span) +
      "</span></div>" +
      "</section>" +
      '<section class="details-group">' +
      '<p class="details-group-label">Planning Context</p>' +
      '<div class="details-field"><span class="details-label">Initiative</span><span>' +
      escapeHtml(selectedItem.task.initiative) +
      "</span></div>" +
      '<div class="details-field"><span class="details-label">Objective</span><span>' +
      escapeHtml(selectedItem.task.objective) +
      "</span></div>" +
      '<div class="details-field details-field--stacked"><span class="details-label">Notes</span><span>' +
      escapeHtml(selectedItem.task.notes) +
      "</span></div>" +
      '<a class="details-link" href="' +
      escapeHtml(selectedItem.task.jiraUrl) +
      '" target="_blank" rel="noreferrer">Open Jira Ticket</a>' +
      "</section>" +
      "</div>";
  }

  function renderCapacity(capacityData) {
    if (!capacityData.length) {
      dom.capacityRoot.innerHTML = renderEmptyState(
        "No visible workload",
        "No assignees are active in the current month and filter combination."
      );
      return;
    }

    dom.capacityRoot.innerHTML =
      '<div class="capacity-list">' +
      capacityData
        .map(function (member) {
          var overlapLabel = member.hasOverlap
            ? "Overlap signal: " +
              String(member.overlappingWeekCount) +
              " week(s), peak " +
              String(member.maxConcurrentTasks) +
              " task(s)"
            : "Overlap signal: none";

          return (
            '<div class="capacity-card">' +
            "<strong>" +
            escapeHtml(member.assignee) +
            "</strong>" +
            '<span class="capacity-status capacity-status--' +
            escapeHtml(member.loadStatus.toLowerCase()) +
            '">' +
            escapeHtml(member.loadStatus) +
            "</span>" +
            '<p class="muted">' +
            "Active tasks: " +
            String(member.activeTaskCount) +
            " | " +
            escapeHtml(member.role) +
            "</p>" +
            '<p class="muted">' +
            escapeHtml(overlapLabel) +
            "</p>" +
            "</div>"
          );
        })
        .join("") +
      "</div>";
  }

  function render() {
    var timeline = buildMonthTimeline(appState.selectedMonth);
    var items = buildVisibleTaskTimelineItems(tasks, timeline);
    var rows = groupTimelineRowsByAssignee(items);
    var capacityData = buildCapacityData(items, timeline);
    var metrics = getSummaryMetrics(items, capacityData);

    syncSelectedTask(items);
    renderHeader(timeline, metrics);
    renderFilters();
    renderMonthNavigation();
    renderRoadmap(timeline, rows);
    renderDetails(items);
    renderCapacity(capacityData);
  }

  function handleFilterChange(event) {
    if (!event.target || !event.target.name) {
      return;
    }

    appState.filters[event.target.name] = event.target.value;
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
    var taskButton = event.target.closest("[data-task-id]");

    if (!taskButton) {
      return;
    }

    appState.selectedTaskId = taskButton.getAttribute("data-task-id") || "";
    render();
  }

  function cacheDom() {
    dom.headerDebug = document.getElementById("header-debug");
    dom.filtersRoot = document.getElementById("filters-root");
    dom.monthNavigationRoot = document.getElementById("month-navigation-root");
    dom.roadmapRoot = document.getElementById("roadmap-root");
    dom.detailsRoot = document.getElementById("details-root");
    dom.capacityRoot = document.getElementById("capacity-root");
  }

  function bindEvents() {
    dom.filtersRoot.addEventListener("input", handleFilterChange);
    dom.filtersRoot.addEventListener("change", handleFilterChange);
    dom.monthNavigationRoot.addEventListener("click", handleMonthClick);
    dom.roadmapRoot.addEventListener("click", handleTaskClick);
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
