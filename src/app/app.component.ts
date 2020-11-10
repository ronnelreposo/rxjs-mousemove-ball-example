import { Component, OnInit } from "@angular/core";
import {
  Subject,
  interval,
  of,
  fromEvent,
  pipe,
  Observable,
  Scheduler,
  defer,
  EMPTY,
  concat
} from "rxjs";
import { animationFrame } from "rxjs/internal/scheduler/animationFrame";
import {
  map,
  debounceTime,
  flatMap,
  takeUntil,
  switchMap,
  scan,
  filter,
  tap,
  take,
  mapTo,
  takeWhile,
  mergeMap,
  startWith,
  withLatestFrom
} from "rxjs/operators";
import * as _ from "lodash";

type Point = { x: number; y: number };

// type EntryTransition = {
//   readonly type: 'entry';
//   percentage: number;
//   position: Point;
// }

// type FadeInTransition = {
//   readonly type: 'fade-in';
//   percentage: number;
//   opacity: number;
// }

type TransitionViewState = {
  stage: 1 | 2;
  color: string;
  position: Point;
  opacity: number;
  percentage: number;
};
type Item = {
  id: number;
  transitionViewState: TransitionViewState;
};
type Progress = { id: number; stage: number; percentage: number };
type Target = { point: Point; opacity: number };
type Data = {
  items: Item[];
};

// Helper Types.
type LogEntry = { id: number; eventType: "click" };
type Logs = { counter: number; logs: LogEntry[] };

@Component({
  selector: "my-app",
  templateUrl: "./app.component.html",
  styleUrls: ["./app.component.css"]
})
export class AppComponent implements OnInit {
  out$: Observable<Point>;

  data$: Observable<Data>;
  runTransitionSubj: Subject<number>;

  logs$: Observable<Logs>;

  ngOnInit() {
    // Represents Dispatch.
    this.runTransitionSubj = new Subject();

    // Helper Functions.
    const toPoint = ev => ({ x: ev.clientX, y: ev.clientY });
    const assertNever = <T>(_: never): T => {
      throw new Error(_ + "is not never");
    };

    // Easing Functions. https://github.com/mattdesl/eases
    const cubicInOut = (t: number) => {
      return t < 0.5
        ? 4.0 * t * t * t
        : 0.5 * Math.pow(2.0 * t - 2.0, 3.0) + 1.0;
    };
    const qinticOut = (t: number) => {
      return --t * t * t * t * t + 1;
    };

    const distanceOverTime = (distance: number) => (t: number) => distance * t;
    const fadeOutOverTime = (opacity: number) => (t: number) =>
      1 + (opacity - t); // Re-evaluate here.

    const initPoint: Point = { x: 0, y: 0 };
    const target: Target = {
      point: { x: 400, y: 0 },
      opacity: 0
    };
    const initialData: Data = {
      items: [
        {
          id: 1,
          transitionViewState: {
            stage: 1,
            color: "#c0392b",
            opacity: 1,
            position: initPoint,
            percentage: 0
          }
        },
        {
          id: 2,
          transitionViewState: {
            stage: 1,
            color: "#2ecc71",
            opacity: 1,
            position: initPoint,
            percentage: 0
          }
        },
        {
          id: 3,
          transitionViewState: {
            stage: 1,
            color: "#f1c40f",
            opacity: 1,
            position: initPoint,
            percentage: 0
          }
        }
      ]
    };

    // HO Observables.
    const msElapsed$ = interval(1, animationFrame);
    const duration$ = (ms: number) =>
      msElapsed$.pipe(
        map(ems => ems / ms),
        takeWhile(t => t <= 1)
      );

    // deltas ----------------------------------------------------
    const deltaPoint = ({ x, y }: Point, t: number): Point => {
      return {
        x: distanceOverTime(x)(t),
        y: distanceOverTime(y)(t)
      };
    };

    const nextStage = (item: Item): Item => {
      const newTransitionViewState: TransitionViewState = {
        ...item.transitionViewState,
        percentage: 0
      };

      switch (newTransitionViewState.stage) {
        default: {
          return assertNever(newTransitionViewState.stage);
        }
        case 1: {
          return {
            ...item,
            transitionViewState: {
              ...newTransitionViewState,
              percentage: 0,
              stage: 2
            }
          };
        }
        case 2: {
          return {
            ...item,
            transitionViewState: {
              ...newTransitionViewState,
              // percentage: 0 *** PERCENTAGE?
              stage: 2
            }
          };
        }
      }
    };

    // Higher Order Functions?
    const transitionStage = (
      item: Item,
      target: Target,
      percentageSoFar: number
    ): Item => {
      const { stage, percentage } = item.transitionViewState;
      const latestTransitionPercentage = Math.max(
        item.transitionViewState.percentage,
        percentageSoFar
      );
      switch (stage) {
        default: {
          return assertNever(stage);
        }
        case 1: {
          // Too primitive.
          if (percentage === 1) {
            // complete stage.
            return nextStage(item);
          } else {
            const newTransitionViewState: TransitionViewState = {
              ...item.transitionViewState,
              position: deltaPoint(target.point, latestTransitionPercentage),
              percentage: latestTransitionPercentage
            };
            return { ...item, transitionViewState: newTransitionViewState };
          }
        }
        case 2: {
          // Too primitive.
          if (percentage === 1) {
            // complete.
            return item;
          } else {
            const newTransitionViewState: TransitionViewState = {
              ...item.transitionViewState,
              opacity: fadeOutOverTime(target.opacity)(
                latestTransitionPercentage
              ),
              percentage: latestTransitionPercentage
            };
            return { ...item, transitionViewState: newTransitionViewState };
          }
        }
      }
    };

    const transitionItem = (progress: Progress) => (target: Target) => (
      item: Item
    ): Item => {
      const { id, stage, percentage } = progress;
      if (!(item.id === id)) {
        return item;
      } else {
        if (stage < item.transitionViewState.stage) {
          return item;
        } else {
          return transitionStage(item, target, percentage);
        }
      }
    };

    const transition = (target: Target) => (
      accData: Data,
      progress: Progress
    ) => {
      const newItems: Item[] = accData.items.map(
        transitionItem(progress)(target)
      );
      return {
        ...accData,
        items: newItems
      };
    };

    const moveMs = 1000;
    const fadeMs = 1000;
    const progressOnId = (id: number): Observable<Progress> =>
      duration$(moveMs).pipe(
        map(cubicInOut),
        map(t => ({ id: id, stage: 1, percentage: t }))
      );

    const fadeInOnId = (id: number): Observable<Progress> =>
      duration$(fadeMs).pipe(
        map(qinticOut),
        map(t => ({ id: id, stage: 2, percentage: t }))
      );

    const moveAndFadeOut = (id: number): Observable<Progress> => {
      const move$ = progressOnId(id);
      const fadeOut$ = fadeInOnId(id);
      const stages$ = concat(move$, fadeOut$);
      return stages$;
    };

    const s1$ = this.runTransitionSubj.pipe(
      mergeMap(moveAndFadeOut),
      scan(transition(target), initialData)
    );

    // event log.
    const initLogs = { logs: [], counter: 0 };
    this.logs$ = this.runTransitionSubj.pipe(
      scan((acc: Logs, id: number): Logs => {
        const nextLogEntry: LogEntry = { id: id, eventType: "click" };
        const newLogs: Logs = {
          counter: acc.counter + 1,
          logs: [...acc.logs, nextLogEntry]
        };
        return newLogs;
      }, initLogs)
    );

    this.data$ = s1$.pipe(startWith(initialData));
  }
}
