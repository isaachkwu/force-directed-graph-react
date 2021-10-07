import sys
import random
from time import time
'''
    args:
    [0]: amount of nodes to be generated,
    [1]: limits of the 'num' attribute,
    [2]: limits of the 'clusters' attribute,
    [3]: amount of pie chart nodes
'''
# check args
num_of_nodes = 50
num_limit = 50
num_of_clusters = 0
num_of_pie_charts = 0
if len(sys.argv) > 1:
    num_of_nodes = int(sys.argv[1])
    print(">> generating JSON files with {0} node(s)".format(
        num_of_nodes), end='')
    if len(sys.argv) > 2:
        num_limit = int(sys.argv[2])
        print(", {0} num limits".format(num_limit), end='')
        if len(sys.argv) > 3:
            num_of_clusters = int(sys.argv[3])
            print(", {0} cluster(s)".format(num_of_clusters), end='')
            if len(sys.argv) > 4:
                num_of_pie_charts = int(sys.argv[4])
                print(",and {0} pie chart(s)".format(
                    num_of_pie_charts), end='')
    print('...')
else:
    print(">> generating JSON with with 50 nodes, 50 num limit no clusters, and no pie charts...")

# genearte JSON
filename = "testData-{0}-{1}-{2}-{3}.json".format(
    num_of_nodes, num_limit, num_of_clusters, num_of_pie_charts)
f = open(filename, "x")
f.write('{"nodes":[')
for x in range(1, num_of_nodes+1):
    if x != 1:
        f.write(',')
    if num_of_pie_charts == 0:
        f.write('{{"id":{0},"num":{1}, "cluster":{2}}}'.format(
            x, random.randint(0, num_limit), random.randint(0, num_of_clusters - 1)))
    else:
        f.write('{{"id":{0},"num":{1}, "cluster":{2}, "pie": {{"label1": {3}, "label2": {4}, "label3": {5}, "label4": {6}}}}}'.format(
            x, random.randint(0, num_limit), random.randint(0, num_of_clusters - 1), random.randint(0, num_limit), random.randint(0, num_limit), random.randint(0, num_limit), random.randint(0, num_limit)))
        num_of_pie_charts -= 1
f.write('],"links":[')
for x in range(1, num_of_nodes):
    if x != 1:
        f.write(',')
    randSource = x
    if randSource > num_of_nodes / 2:
        randTarget = random.randint(1, randSource - 1)
    else:
        randTarget = random.randint(randSource + 1, num_of_nodes)
    f.write('{{"id":{0},"source":{1},"target":{2}}}'.format(
        num_of_nodes+x, randSource, randTarget))
f.write(']}')
print(">> Generated a JSON file: {}".format(filename))
