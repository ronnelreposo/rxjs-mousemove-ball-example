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
  EMPTY
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
type TransitionViewState = {
  color: string;
  position: Point;
  percentage: number;
};
type Item = {
  id: number;
  transitionViewState: TransitionViewState;
};
type IdAndPercentage = { id: number; t: number };
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
    const cubicInOut = (t: number) => {
      return t < 0.5
        ? 4.0 * t * t * t
        : 0.5 * Math.pow(2.0 * t - 2.0, 3.0) + 1.0;
    };
    const distance = (d: number) => (t: number) => d * t;

    const initPoint: Point = { x: 0, y: 0 };
    const targetPoint: Point = { x: 400, y: 0 };
    const initialData: Data = {
      items: [
        {
          id: 1,
          transitionViewState: {
            color: "#c0392b",
            position: initPoint,
            percentage: 0
          }
        },
        {
          id: 2,
          transitionViewState: {
            color: "#2ecc71",
            position: initPoint,
            percentage: 0
          }
        },
        {
          id: 3,
          transitionViewState: {
            color: "#f1c40f",
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
        x: distance(x)(t),
        y: distance(y)(t)
      };
    };

    const f1 = (target: Point) => (
      accData: Data,
      idAndPercentage: IdAndPercentage
    ) => {
      const { id, t } = idAndPercentage;

      const newItems: Item[] = accData.items.map(item => {
        if (!(item.id === id)) {
          return item;
        } else {
          // Too primitive.
          if (item.transitionViewState.percentage === 1) {
            // complete.
            return item;
          } else {
            const maxTransitionPercentage = Math.max(
              item.transitionViewState.percentage,
              t
            );
            const newTransitionViewState: TransitionViewState = {
              ...item.transitionViewState,
              position: deltaPoint(target, maxTransitionPercentage),
              percentage: maxTransitionPercentage
            };
            return { ...item, transitionViewState: newTransitionViewState };
          }
        }
      });

      return {
        ...accData,
        items: newItems
      };
    };

    const durationMs = 1000;
    const progressOnId = (id: number): Observable<IdAndPercentage> =>
      duration$(durationMs).pipe(
        map(cubicInOut),
        map(t => ({ id: id, t: t }))
      );

    const s1$ = this.runTransitionSubj.pipe(
      mergeMap(progressOnId),
      scan(f1(targetPoint), initialData)
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
