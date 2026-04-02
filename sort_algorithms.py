"""
sort_algorithms.py
AllSortAnimationByBar.py のアルゴリズム群を
グローバル変数なし・JSON シリアライズ可能な形に移植
"""

import math
import random
from random import randint
import functools

# ---------------------------------------------------------------------------
# アルゴリズム一覧 / データサイズ一覧
# ---------------------------------------------------------------------------

DataSizeList = [16, 32, 64, 100, 128, 200, 256]

DataConditionList = [
    "ランダム",
    "昇順",
    "降順",
    "ほぼ昇順",
    "ステップ値",
]

# ---------------------------------------------------------------------------
# ヘルパー
# ---------------------------------------------------------------------------

def make_frame(data, color, *, arrows=None, texts=None, lines=None,
               bars=None, finished=False):
    """generator が yield する共通フレーム形式を生成する"""
    return {
        "data":     list(data),
        "color":    list(color),
        "arrows":   arrows  or [],   # [[start, end], ...]
        "texts":    texts   or [],   # ["i=3", ...]
        "lines":    lines   or [],   # [[value, start, end], ...]
        "bars":     bars    or [],   # highlight されるバーのインデックス
        "finished": finished,
    }


def make_data(num_items: int, data_max: int, condition: int):
    """指定条件の data / color リストを返す"""
    if condition == 1:          # 昇順
        data = sorted([randint(1, data_max) for _ in range(num_items)])
    elif condition == 2:        # 降順
        data = sorted([randint(1, data_max) for _ in range(num_items)],
                      reverse=True)
    elif condition == 3:        # ほぼ昇順
        lst = sorted([randint(1, data_max) for _ in range(num_items)])
        for _ in range(max(1, num_items // 10)):
            i, j = random.sample(range(num_items), 2)
            lst[i], lst[j] = lst[j], lst[i]
        data = lst
    elif condition == 4:        # ステップ値
        steps = max(2, int(math.sqrt(num_items)))
        pool  = [randint(1, data_max // steps) + i * (data_max // steps)
                 for i in range(steps)]
        data  = random.choices(pool, k=num_items)
    else:                       # ランダム
        data = [randint(1, data_max) for _ in range(num_items)]

    color = ["b"] * num_items
    return data, color


# ---------------------------------------------------------------------------
# ソートアルゴリズム群  (global 変数なし / generator)
# ---------------------------------------------------------------------------

def bubble_sort(data, color):
    n = len(data)
    for i in range(n - 1):
        for j in range(n - i - 1):
            color[j] = "r"; color[j + 1] = "y"
            yield make_frame(data, color,
                             texts=[f"i={i}  {j}⇔{j+1}"], bars=[j, j+1])
            if data[j] > data[j + 1]:
                yield make_frame(data, color, arrows=[[j, j+1]],
                                 texts=[f"i={i}  {j}⇄{j+1}"], bars=[j, j+1])
                data[j], data[j + 1] = data[j + 1], data[j]
                color[j], color[j + 1] = color[j + 1], color[j]
                color[j] = "b"
                yield make_frame(data, color, arrows=[[j, j+1]],
                                 texts=[f"i={i}  {j}⇔{j+1}"], bars=[j, j+1])
            else:
                color[j] = "b"; color[j + 1] = "b"
                yield make_frame(data, color,
                                 texts=[f"i={i}  {j}⇔{j+1}"], bars=[j, j+1])
        color[n - i - 1] = "g"
        yield make_frame(data, color, bars=[n - i - 1])
    yield make_frame(data, color, finished=True)


def selection_sort(data, color):
    n = len(data)
    for i in range(n - 1):
        min_idx = i
        color[min_idx] = "r"
        yield make_frame(data, color,
                         texts=[f"i={i}  min={min_idx}"],
                         lines=[[data[min_idx], i, n - 1]], bars=[i])
        for j in range(i + 1, n):
            color[j] = "y"
            yield make_frame(data, color,
                             texts=[f"i={i}  min={min_idx}  j={j}"],
                             lines=[[data[min_idx], i, n - 1]], bars=[j])
            if data[j] < data[min_idx]:
                color[j], color[min_idx] = "r", "b"
                old_min = min_idx; min_idx = j
                yield make_frame(data, color,
                                 texts=[f"i={i}  min={min_idx}  j={j}"],
                                 lines=[[data[min_idx], i, n - 1]],
                                 bars=[old_min, j])
            else:
                color[j] = "b"
                yield make_frame(data, color,
                                 texts=[f"i={i}  min={min_idx}  j={j}"],
                                 lines=[[data[min_idx], i, n - 1]], bars=[j])
        if i != min_idx:
            yield make_frame(data, color,
                             arrows=[[i, min_idx]],
                             texts=[f"i={i} ⇄ min={min_idx}"],
                             lines=[[data[min_idx], i, n - 1]],
                             bars=[i, min_idx])
            data[i], data[min_idx] = data[min_idx], data[i]
            color[i], color[min_idx] = color[min_idx], color[i]
            yield make_frame(data, color,
                             arrows=[[i, min_idx]],
                             texts=[f"i={i} ⇄ min={min_idx}"],
                             lines=[[data[min_idx], i, n - 1]],
                             bars=[i, min_idx])
        color[i] = "g"
        yield make_frame(data, color,
                         texts=[f"i={i} 確定 min={min_idx}"], bars=[i])
    yield make_frame(data, color, finished=True)


def insertion_sort(data, color):
    n = len(data)
    for i in range(1, n):
        color[i] = "r"
        key = data[i]
        yield make_frame(data, color, texts=[f"i={i}  key={key}"], bars=[i])
        j = i - 1
        while j >= 0 and key < data[j]:
            yield make_frame(data, color, arrows=[[j, j+1]],
                             texts=[f"i={i}  j={j}  key={key}"],
                             bars=[j, j+1])
            data[j + 1], data[j] = data[j], data[j + 1]
            color[j + 1], color[j] = color[j], color[j + 1]
            yield make_frame(data, color, arrows=[[j, j+1]],
                             texts=[f"i={i}  j={j}  key={key}"],
                             bars=[j, j+1])
            j -= 1
        data[j + 1] = key
        color[j + 1] = "b"
        yield make_frame(data, color, texts=[f"i={i}  key={key} 挿入"],
                         bars=[j + 1])
    yield make_frame(data, color, finished=True)


def shell_sort(data, color):
    n = len(data)
    h = 1
    while h < n:
        h = 3 * h + 1
    h = (h - 1) // 3
    while h > 0:
        for i in range(h, n):
            color[i] = "r"
            key = data[i]
            yield make_frame(data, color,
                             texts=[f"h={h}  i={i}"], bars=[i])
            j = i - h
            while j >= 0 and key < data[j]:
                yield make_frame(data, color,
                                 texts=[f"h={h}  i={i}  j={j}⇔j+h={j+h}"],
                                 bars=[j, j + h])
                data[j + h], data[j] = data[j], data[j + h]
                color[j + h], color[j] = color[j], color[j + h]
                yield make_frame(data, color, arrows=[[j, j + h]],
                                 texts=[f"h={h}  i={i}  j={j}⇄j+h={j+h}"],
                                 bars=[j, j + h])
                j -= h
            data[j + h] = key
            color[j + h] = "b"
            yield make_frame(data, color, texts=[f"h={h}  i={i}"],
                             bars=[j + h])
        h = (h - 1) // 3
    yield make_frame(data, color, finished=True)


def quick_sort(data, color, option=None):
    n = len(data)
    stack = [(0, n - 1)]
    while stack:
        first, last = stack.pop()
        if first < last:
            # ピボット選択
            if first + 2 < last:
                if option == "Select3":
                    mid = (first + last) // 2
                    pivd = sorted([(data[first], first),
                                   (data[mid], mid),
                                   (data[last], last)],
                                  key=lambda x: x[0])
                    piv = pivd[1][1]
                    color[first] = color[last] = color[mid] = "m"
                    texts = [f"中央値選択  mid={mid}  first={first}  last={last}"]
                    yield make_frame(data, color,
                                     texts=texts,
                                     lines=[[data[last], first, last]],
                                     bars=[first, last, mid])
                    arrows = [[piv, last]] if piv != last else []
                    color[piv] = "c"
                    yield make_frame(data, color, arrows=arrows,
                                     texts=texts,
                                     lines=[[data[piv], first, last]],
                                     bars=[first, last, mid])
                    data[piv], data[last] = data[last], data[piv]
                    color[first] = color[last] = color[mid] = "b"
                    color[last] = "c"
                elif option == "Random":
                    piv = randint(first, last)
                    color[last] = "y"; color[piv] = "c"
                    texts = [f"ランダム選択={piv}  first={first}  last={last}"]
                    yield make_frame(data, color,
                                     arrows=[[piv, last]], texts=texts,
                                     lines=[[data[piv], first, last]],
                                     bars=[piv, last])
                    data[piv], data[last] = data[last], data[piv]
                    color[last] = "c"; color[piv] = "b"

            pivot = data[last]
            color[last] = "r"
            lines = [[pivot, first, last]]
            texts = [f"pivot={pivot}  first={first}  last={last}"]
            yield make_frame(data, color, texts=texts, lines=lines, bars=[last])
            i = first; j = last - 1
            color[i] = "y"
            if j > first:
                color[j] = "m"
            while True:
                if i < last:   color[i] = "y"
                if j > first:  color[j] = "m"
                while i < last and data[i] < pivot:
                    color[i] = "b"; i += 1
                    if i < last: color[i] = "y"
                    if n <= 100:
                        yield make_frame(data, color, texts=texts,
                                         lines=lines, bars=[i])
                while j >= first and data[j] > pivot:
                    color[j] = "b"; j -= 1
                    if j > first: color[j] = "m"
                    if n <= 100:
                        yield make_frame(data, color, texts=texts,
                                         lines=lines, bars=[j])
                if i >= j:
                    break
                data[i], data[j] = data[j], data[i]
                color[i], color[j] = color[j], color[i]
                yield make_frame(data, color, arrows=[[i, j]],
                                 texts=texts, lines=lines, bars=[i, j])
                color[i] = color[j] = "b"
                yield make_frame(data, color, texts=texts,
                                 lines=lines, bars=[i, j])
                i += 1; j -= 1
                yield make_frame(data, color, texts=texts,
                                 lines=lines, bars=[i, j])
            yield make_frame(data, color, arrows=[[i, last]],
                             texts=texts, lines=lines, bars=[i, last])
            data[i], data[last] = data[last], data[i]
            color[i], color[last] = color[last], color[i]
            color[i] = "g"; color[last] = "b"
            yield make_frame(data, color, arrows=[[i, last]],
                             texts=texts, lines=lines, bars=[i, last])
            stack.append((i + 1, last))
            stack.append((first, i - 1))
        elif last > 0:
            color[last] = "gray"
            yield make_frame(data, color, bars=[last])
    yield make_frame(data, color, finished=True)


quick_sort_select3  = functools.partial(quick_sort, option="Select3")
quick_sort_random   = functools.partial(quick_sort, option="Random")


def bitonic_sort(data, color):
    n = len(data)
    N = math.floor(math.log(n, 2))
    num = 2 ** N          # 実際に使う要素数 (2の冪)
    for fb in range(1, N + 1):
        yield make_frame(data, color, texts=[f"fb={fb}"])
        for sb in range(fb - 1, -1, -1):
            yield make_frame(data, color, texts=[f"fb={fb}  sb={sb}"])
            for i in range(1 << N):
                if ((i >> fb) & 1) ^ ((i >> sb) & 1) == 1:
                    j = i ^ (1 << sb)
                    color[i] = "r"; color[j] = "y"
                    yield make_frame(data, color,
                                     texts=[f"fb={fb}  sb={sb}  {i}⇔{j}"],
                                     bars=[i, j])
                    if data[i] < data[j]:
                        data[i], data[j] = data[j], data[i]
                        color[i], color[j] = color[j], color[i]
                        yield make_frame(data, color, arrows=[[i, j]],
                                         texts=[f"fb={fb}  sb={sb}  {i}⇄{j}"],
                                         bars=[i, j])
                    color[i] = "b"; color[j] = "b"
                    yield make_frame(data, color,
                                     texts=[f"fb={fb}  sb={sb}  {i}⇔{j}"],
                                     bars=[i, j])
    yield make_frame(data, color, finished=True)


def _bitonic_swap_gen(data, color, fb, sb, i):
    """並列バイトニックソート用サブgenerator"""
    j = i ^ (1 << sb)
    color[i] = "r"; color[j] = "y"
    yield False, {"arrows": [[i, j]], "bars": [i, j]}
    if data[i] < data[j]:
        data[i], data[j] = data[j], data[i]
        color[i], color[j] = color[j], color[i]
        yield False, {"arrows": [[i, j]], "bars": [i, j]}
    color[i] = "b"; color[j] = "b"
    yield True,  {"arrows": [], "bars": [i, j]}


def bitonic_sort_parallel(data, color):
    n = len(data)
    N = math.floor(math.log(n, 2))
    for fb in range(1, N + 1):
        yield make_frame(data, color, texts=[f"fb={fb}"])
        for sb in range(fb - 1, -1, -1):
            tasks = []
            for i in range(1 << N):
                if ((i >> fb) & 1) ^ ((i >> sb) & 1) == 1:
                    tasks.append(_bitonic_swap_gen(data, color, fb, sb, i))
            while tasks:
                arrows, bars, new_tasks = [], [], []
                for task in tasks:
                    done, info = next(task)
                    arrows.extend(info["arrows"])
                    bars.extend(info["bars"])
                    if not done:
                        new_tasks.append(task)
                yield make_frame(data, color,
                                 arrows=arrows,
                                 texts=[f"fb={fb}  sb={sb}  tasks={len(tasks)}"],
                                 bars=bars)
                tasks = new_tasks
    yield make_frame(data, color, finished=True)


def comb_sort(data, color):
    n = len(data)
    h = n * 10 // 13
    while True:
        if h in (9, 10):
            h = 11
        swapped = False
        for i in range(n - h):
            color[i] = "r"; color[i + h] = "y"
            yield make_frame(data, color,
                             texts=[f"h={h}  i={i}⇔i+h={i+h}"],
                             bars=[i, i + h])
            if data[i] > data[i + h]:
                data[i + h], data[i] = data[i], data[i + h]
                color[i + h], color[i] = color[i], color[i + h]
                swapped = True
                yield make_frame(data, color, arrows=[[i, i + h]],
                                 texts=[f"h={h}  i={i}⇄i+h={i+h}"],
                                 bars=[i, i + h])
            color[i] = "b"; color[i + h] = "b"
            yield make_frame(data, color,
                             texts=[f"h={h}  i={i}⇔i+h={i+h}"],
                             bars=[i, i + h])
        yield make_frame(data, color, texts=[f"h={h}"])
        if h == 1:
            if not swapped:
                break
        else:
            h = h * 10 // 13
    yield make_frame(data, color, finished=True)


def gnome_sort(data, color):
    n = len(data)
    i = 0
    while i < n:
        color[i] = "r"
        yield make_frame(data, color, texts=[f"i={i}"], bars=[i])
        if i == 0:
            color[i] = "b"
            yield make_frame(data, color, texts=[f"i={i}"], bars=[i])
            i += 1
        else:
            color[i - 1] = "y"
            yield make_frame(data, color, texts=[f"i={i}"], bars=[i - 1, i])
            if data[i - 1] <= data[i]:
                color[i - 1] = "b"
                yield make_frame(data, color, texts=[f"i={i}"], bars=[i - 1])
                i += 1
                color[i - 1] = "b"
            else:
                data[i], data[i - 1] = data[i - 1], data[i]
                color[i - 1] = "r"; color[i] = "y"
                yield make_frame(data, color, arrows=[[i - 1, i]],
                                 texts=[f"i={i}"], bars=[i - 1, i])
                color[i] = "b"
                i -= 1
    yield make_frame(data, color, finished=True)


def pancake_sort(data, color):
    n = len(data)
    for i in range(n, 1, -1):
        max_idx = 0
        color[max_idx] = "r"
        yield make_frame(data, color,
                         texts=[f"i={i}  max={max_idx}"],
                         lines=[[data[max_idx], 0, i]], bars=[0])
        for j in range(1, i):
            color[j] = "y"
            yield make_frame(data, color,
                             texts=[f"i={i}  max={max_idx}  j={j}"],
                             lines=[[data[max_idx], 0, i]], bars=[j])
            if data[j] > data[max_idx]:
                color[j], color[max_idx] = "r", "b"
                old_max = max_idx; max_idx = j
                yield make_frame(data, color,
                                 texts=[f"i={i}  max={max_idx}  j={j}"],
                                 lines=[[data[max_idx], 0, i]],
                                 bars=[old_max, j])
            else:
                color[j] = "b"
                yield make_frame(data, color,
                                 texts=[f"i={i}  max={max_idx}  j={j}"],
                                 lines=[[data[max_idx], 0, i]], bars=[j])
        color[max_idx] = "b"
        if max_idx != i - 1:
            # flip 0..max_idx
            if max_idx > 0:
                for k in range((max_idx + 1) // 2):
                    color[k] = "c"; color[max_idx - k] = "y"
                    yield make_frame(data, color,
                                     arrows=[[k, max_idx - k]],
                                     texts=[f"i={i}  反転 0-{max_idx}"],
                                     bars=[k, max_idx - k])
                    data[k], data[max_idx - k] = data[max_idx - k], data[k]
                    color[k] = "y"; color[max_idx - k] = "c"
                    yield make_frame(data, color,
                                     arrows=[[k, max_idx - k]],
                                     texts=[f"i={i}  反転 0-{max_idx}"],
                                     bars=[k, max_idx - k])
                    color[k] = "b"; color[max_idx - k] = "b"
                    yield make_frame(data, color,
                                     texts=[f"i={i}  反転 0-{max_idx}"],
                                     bars=[k, max_idx - k])
            # flip 0..i-1
            if i - 1 > 0:
                for k in range(i // 2):
                    color[k] = "c"; color[i - 1 - k] = "y"
                    yield make_frame(data, color,
                                     arrows=[[k, i - 1 - k]],
                                     texts=[f"i={i}  反転 0-{i-1}"],
                                     bars=[k, i - 1 - k])
                    data[k], data[i - 1 - k] = data[i - 1 - k], data[k]
                    color[k] = "y"; color[i - 1 - k] = "c"
                    yield make_frame(data, color,
                                     arrows=[[k, i - 1 - k]],
                                     texts=[f"i={i}  反転 0-{i-1}"],
                                     bars=[k, i - 1 - k])
                    color[k] = "b"; color[i - 1 - k] = "b"
                    yield make_frame(data, color,
                                     texts=[f"i={i}  反転 0-{i-1}"],
                                     bars=[k, i - 1 - k])
        color[i - 1] = "g"
        yield make_frame(data, color,
                         texts=[f"i={i}  max={max_idx} 確定"], bars=[i - 1])
    yield make_frame(data, color, finished=True)


# ---------------------------------------------------------------------------
# アルゴリズム一覧 (名前, 関数)
# ---------------------------------------------------------------------------

AlgorithmList = [
    ("バブルソート",                        bubble_sort),
    ("選択ソート",                          selection_sort),
    ("挿入ソート",                          insertion_sort),
    ("シェルソート",                        shell_sort),
    ("クイックソート",                      quick_sort),
    ("クイックソート (3点中央値)",          quick_sort_select3),
    ("クイックソート (ランダム選択)",       quick_sort_random),
    ("バイトニックソート",                  bitonic_sort),
    ("並列バイトニックソート",              bitonic_sort_parallel),
    ("コムソート",                          comb_sort),
    ("ノームソート",                        gnome_sort),
    ("パンケーキソート",                    pancake_sort),
]
