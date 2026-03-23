(function () {
  "use strict";

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
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

  function renderWeekHeader(weeks) {
    return weeks
      .map(function (week) {
        return '<div class="timeline-week-cell">' + escapeHtml(week.label) + "</div>";
      })
      .join("");
  }

  function renderTaskItem(item, selectedTaskId) {
    return (
      '<button class="timeline-task timeline-task--' +
      escapeHtml(toToken(item.task.status)) +
      (item.overlapsPartially ? " timeline-task--partial" : "") +
      (item.task.id === selectedTaskId ? " is-selected" : "") +
      '" type="button" data-task-id="' +
      escapeHtml(item.task.id) +
      '" style="grid-column:' +
      String(item.gridColumnStart) +
      " / " +
      String(item.gridColumnEnd) +
      ";grid-row:" +
      String(item.laneIndex + 1) +
      ';">' +
      '<span class="timeline-task-status">' +
      escapeHtml(item.task.status) +
      "</span>" +
      '<span class="timeline-task-title">' +
      escapeHtml(item.task.title) +
      "</span>" +
      '<span class="timeline-task-meta">' +
      escapeHtml(item.task.stream) +
      " | " +
      escapeHtml(item.task.status) +
      "</span>" +
      '<span class="timeline-task-flags">' +
      (item.startsBeforeMonth ? "&larr; " : "") +
      "W" +
      String(item.startWeekIndex + 1) +
      " - W" +
      String(item.endWeekIndex + 1) +
      " | span " +
      String(item.span) +
      (item.endsAfterMonth ? " &rarr;" : "") +
      "</span>" +
      "</button>"
    );
  }

  function renderRow(row, timeline, selectedTaskId) {
    return (
      '<div class="timeline-assignee-cell">' +
      "<strong>" +
      escapeHtml(row.assignee) +
      "</strong>" +
      '<p class="muted">' +
      escapeHtml(row.role) +
      " | Lanes: " +
      String(row.laneCount) +
      "</p>" +
      "</div>" +
      '<div class="timeline-lanes" style="--week-count:' +
      String(timeline.weekCount) +
      ";--lane-count:" +
      String(row.laneCount) +
      ';">' +
      row.items
        .map(function (item) {
          return renderTaskItem(item, selectedTaskId);
        })
        .join("") +
      "</div>"
    );
  }

  function render(params) {
    var timeline = params.timeline;
    var rows = Array.isArray(params.rows) ? params.rows : [];
    var selectedTaskId = params.selectedTaskId || "";
    var summaryLabel = params.summaryLabel || "";

    if (!timeline || !timeline.weeks || !timeline.weeks.length) {
      return renderEmptyState("No timeline", "The selected month does not contain a valid week structure.");
    }

    if (!rows.length) {
      return (
        renderEmptyState("No matching tasks", "Try a different month or loosen the current filters.") +
        '<div class="timeline-grid timeline-grid--header-only">' +
        '<div class="timeline-corner">Assignee</div>' +
        '<div class="timeline-weeks" style="--week-count:' +
        String(timeline.weekCount) +
        ';">' +
        renderWeekHeader(timeline.weeks) +
        "</div>" +
        "</div>"
      );
    }

    return (
      '<div class="roadmap-debug-summary">' +
      '<p class="muted">' +
      escapeHtml(summaryLabel) +
      "</p>" +
      "</div>" +
      '<div class="timeline-grid">' +
      '<div class="timeline-corner">Assignee</div>' +
      '<div class="timeline-weeks" style="--week-count:' +
      String(timeline.weekCount) +
      ';">' +
      renderWeekHeader(timeline.weeks) +
      "</div>" +
      rows
        .map(function (row) {
          return renderRow(row, timeline, selectedTaskId);
        })
        .join("") +
      "</div>"
    );
  }

  window.RoadmapTimeline = {
    render: render
  };
})();
