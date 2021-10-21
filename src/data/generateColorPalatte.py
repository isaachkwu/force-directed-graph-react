from random import randint
import sys

if len(sys.argv) == 2:
   num_of_colors = int(sys.argv[1])
   print(">> generating {} colors JSON file...".format(num_of_colors))

filename = "colors-{0}.json".format(num_of_colors)
colors = []
f = open(filename, "x")
f.write('{"colors":[')
valid_char = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B', 'C', 'D', 'E', 'F']
for x in range(0, num_of_colors):
    if x != 0:
        f.write(',')
    color = ''.join([valid_char[randint(0, len(valid_char)-1)] for y in range(0, 6)])
    while color in colors:
        color = ''.join([valid_char[randint(0, len(valid_char)-1)] for y in range(0, 6)])
    colors.append(color)
    f.write('"#' + color + '"')
f.write(']}')
print(">> Generated a colors JSON file: {}".format(filename))