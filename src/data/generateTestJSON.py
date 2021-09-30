import sys
import random
from time import time

# check args
if len(sys.argv) == 2 :
   num_of_nodes = int(sys.argv[1])
   print(">> generating {} nodes JSON file...".format(num_of_nodes))
elif len(sys.argv) == 1:
    print(">> generating 5000 (default) nodes JSON file...")
else:
    print("!! Invalid arguments, please input the number of nodes as arguments.")
    sys.exit()

# genearte JSON
filename = "testData-{0}-{1}.json".format(num_of_nodes, time())
f = open(filename, "x")
f.write('{"nodes":[')
for x in range(1, num_of_nodes+1):
    if x != 1:
        f.write(',')
    f.write('{{"id":{0},"num":{0}}}'.format(x))
f.write('],"links":[')
for x in range(1, num_of_nodes):
    if x != 1:
        f.write(',')
    randSource = x
    if randSource > num_of_nodes / 2:
        randTarget = random.randint(1, randSource - 1)
    else:
        randTarget = random.randint(randSource + 1, num_of_nodes)
    f.write('{{"id":{0},"source":{1},"target":{2}}}'.format(num_of_nodes+x, randSource, randTarget))
f.write(']}')
print(">> Generated a JSON file: {}".format(filename))