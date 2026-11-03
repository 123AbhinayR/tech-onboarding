import type { Assignment } from "./db.js";
import { collections } from "./db.js";
import { ObjectId } from "mongodb";

export type AssignResult =
  | { kind: "assigned"; assignment: Assignment }
  | { kind: "judge-busy" }
  | { kind: "none-available" };

export async function assignNext(judgeId: string): Promise<AssignResult> {
  const db = collections();
  const projects = await db.projects.find().toArray();
  const assignments = await db.assignments.find().toArray();

  //Check if judge is busy
  for (const assignment of assignments) {
    if (assignment.judgeId === judgeId && assignment.status === "QUEUED") {
      return {kind: "judge-busy"};
    }
  }

  let lowestCount = Infinity;
  let projectIds: string[] = [];

  for (const project of projects) {
    let available = true;
    let count = 0;

    for (const assignment of assignments) {
      if (assignment.projectId !== project._id) {
        continue;
      }

      if (assignment.judgeId === judgeId || assignment.status === "QUEUED") {
        available = false;
        break;
      }

      if (assignment.status === "COMPLETED") {
        count++;
      }
    }

    if (!available) {
      continue;
    }

    //Keep projects with the lowest count
    if (count < lowestCount) {
      lowestCount = count;
      projectIds = [project._id];
    } 
    else if (count === lowestCount) {
      projectIds.push(project._id);
    }
  }

  if (projectIds.length === 0) {
    return { kind: "none-available" };
  }

  //Pick a random project from the ties
  const index = Math.floor(Math.random() * projectIds.length);
  const projectId = projectIds[index];

  if (projectId === undefined) {
    return { kind: "none-available" };
  }

  const assignment: Assignment = {
    _id: new ObjectId(),
    judgeId: judgeId,
    projectId: projectId,
    status: "QUEUED",
    createdAt: new Date(),
  };

  await db.assignments.insertOne(assignment);
  return {kind: "assigned", assignment: assignment};
}