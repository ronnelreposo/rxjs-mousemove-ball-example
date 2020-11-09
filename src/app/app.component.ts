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
  startWith
} from "rxjs/operators";

type Point = { x: number; y: number };
type TransitionViewState = {
  color: string;
  position: Point;
};
type Item = {
  id: number;
  transitionViewState: TransitionViewState;
};
type Data = {
  items: Item[];
};

@Component({
  selector: "my-app",
  templateUrl: "./app.component.html",
  styleUrls: ["./app.component.css"]
})
export class AppComponent implements OnInit {
  out$: Observable<Point>;

  data$: Observable<Data>;
  runTransitionSubj: Subject<number>;

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
    const initialData: Data = {
      items: [
        {
          id: 1,
          transitionViewState: { color: "#c0392b", position: initPoint }
        },
        {
          id: 2,
          transitionViewState: { color: "#2ecc71", position: initPoint }
        },
        {
          id: 3,
          transitionViewState: { color: "#f1c40f", position: initPoint }
        }
      ]
    };

    // HOD Observables.
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
    const updateItemPositions = (targetPoint: Point) => (data: Data) => (
      t: number
    ): Data => {
      const newItems: Item[] = data.items.map(item => {
        const newTransitionViewState: TransitionViewState = {
          ...item.transitionViewState,
          position: deltaPoint(targetPoint, t)
        };

        return { ...item, transitionViewState: newTransitionViewState };
      });

      return {
        ...data,
        items: newItems
      };
    };

    // TODO. abstract more.
    const f = (data: Data, durationMs: number, targetPoint: Point) => (
      id: number
    ): Observable<Data> => {
      // mapping all items.
      const data$ = duration$(durationMs).pipe(
        map(cubicInOut),
        map(updateItemPositions(targetPoint)(data))
      );

      // find in the data, minimal.
      // const items$ = data.items.map(item => {

      //   if (item.id === id) {
      //     return duration$(durationMs).pipe(
      //       map(cubicInOut),
      //       map(t => ({
      //         x: distance(target.x)(t),
      //         y: distance(target.y)(t)
      //       }))
      //     )
      //   } else {
      //     return EMPTY;
      //   }
      // });

      return data$;
    };

    const target: Point = { x: 400, y: 0 };
    const durationMs = 300;
    this.data$ = this.runTransitionSubj.pipe(
      switchMap(f(initialData, durationMs, target)),
      startWith(initialData)
    );

    // const target$ = fromEvent(document, "mousedown").pipe(map(toPoint));

    // let ball = document.getElementById("ball");

    // duration in percentage.

    // const s$ = target$.pipe(
    //   switchMap(({ x, y }) =>
    //     duration$(durationMs).pipe(
    //       map(cubicInOut),
    //       map(t => ({
    //         x: distance(target.x)(t),
    //         y: distance(target.y)(t)
    //       }))
    //     )
    //   )
    // );

    // this.out$ = s$;

    // when done, simply call sub.unsubscribe();
    // let sub = s$.subscribe(({ x, y }) => {
    //   ball.style.transform = `translate3d(${x}px, ${y}px, ${0}px)`;
    // });
  }
}
