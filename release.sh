uglifyjs --compress --mangle --mangle-props -- digviewer.js > digviewer.min.js
uglifycss digviewer.css > digviewer.min.css

echo '/*DIGViewer 0.1, Copyright 2013-2016 McGill University. Licensed under the LGPL license.*/' | cat - digviewer.min.js > temp && mv temp digviewer.min.js
echo '/*DIGViewer 0.1, Copyright 2013-2016 McGill University. Licensed under the LGPL license.*/' | cat - digviewer.min.css > temp && mv temp digviewer.min.css