DIGViewer
=========

Usage example available here: https://epigenomesportal.ca/digviewer

Usage
-----

### Data Definition

```
cell_types = [
    { id: 1, name: "Blood" },
    { id: 2, name: "Brain" },
    { id: 3, name: "Liver" },
    { id: 4, name: "Kidney" },
    { id: 5, name: "Bone" },
    { id: 6, name: "Muscle" }
];

assays = [
    { id: 1, short_name: "wgs", name: "Whole-Genome Sequencing" },
    { id: 2, short_name: "wgbs", name: "Bisulfite Sequencing" },
    { id: 3, short_name: "rnas", name: "RNA-Seq" },
    { id: 4, short_name: "450k", name: "Illumina 450K Chip" }
];

data = [
    {celltype: 1, assay: 1, data: [{name: "exp15", ref_genome: "hg19"}]},
    {celltype: 1, assay: 2, data: [{name: "exp01", ref_genome: "hg19"}]},
    {celltype: 2, assay: 1, data: [{name: "exp02", ref_genome: "hg19"}, {name: "exp03", ref_genome: "hg38"}]},
    {celltype: 3, assay: 2, data: [{name: "exp04", ref_genome: "hg19"}, {name: "exp05", ref_genome: "hg38"}, {name: "exp06", ref_genome: "mm10"}]},
    {celltype: 4, assay: 1, data: [{name: "exp07", ref_genome: "hg19"}, {name: "exp08", ref_genome: "hg38"}]},
    {celltype: 5, assay: 4, data: [{name: "exp09", ref_genome: "hg19"}, {name: "exp10", ref_genome: "hg19"}]},
    {celltype: 6, assay: 3, data: [{name: "exp11", ref_genome: "mm10"}, {name: "exp12", ref_genome: "hg19"}, {name: "exp13", ref_genome: "hg38"}, {name: "exp14", ref_genome: "hg38"}]}
];
```

### Sort functions definition
```
var sortFunctions = {
    row_sort_function_asc: function(p1, p2) {
        return p1.name.toLowerCase().localeCompare(p2.name.toLowerCase());
    },
    row_sort_function_desc: function(p1, p2) {
        return p2.name.toLowerCase().localeCompare(p1.name.toLowerCase());
    },
    column_sort_function_asc: function(p1, p2) {
        return p1.name.toLowerCase().localeCompare(p2.name.toLowerCase());
    },
    column_sort_function_desc: function(p1, p2) {
        return p2.name.toLowerCase().localeCompare(p1.name.toLowerCase());
    }
}
```

### DIGViewer instantiation and display
```
digViewer = new DigViewer(document.getElementById("gridContainer"), {
    row_data_field: "celltype",
    row_sort_function: sortFunctions.row_sort_function_asc,
    row_label_function: function(d, i) {return d.name;},

    column_data_field: "assay",
    column_sort_function: sortFunctions.column_sort_function_asc,
    column_label_function: function(d, i) {return d.name;},

    onGridSelectionChanged: updateTable,
});

digViewer.drawGrid(data, cell_types, assays);
```
