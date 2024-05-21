var x, i, j, l, ll, selElmnt, a, b, c;
/*look for any elements with the class "custom-select":*/
x = document.getElementsByClassName("custom-select");
l = x.length;
for (i = 0; i < l; i++) {
    selElmnt = x[i].getElementsByTagName("select")[0];
    ll = selElmnt.length;
    /*for each element, create a new DIV that will act as the selected item:*/
    a = document.createElement("DIV");
    a.setAttribute("class", "select-selected");
    a.innerHTML = '<img src="' + selElmnt.options[selElmnt.selectedIndex].getAttribute('src') + '">';
    a.firstElementChild.classList.add(selElmnt.options[selElmnt.selectedIndex].getAttribute('class'));
    x[i].appendChild(a);
    x[i].value = selElmnt.options[0].getAttribute('src');
    /*for each element, create a new DIV that will contain the option list:*/
    b = document.createElement("DIV");
    b.setAttribute("class", "select-items select-hide pixel-corners-4-6");
    for (j = 1; j < ll; j++) {
        /*for each option in the original select element,
        create a new DIV that will act as an option item:*/
        c = document.createElement("DIV");
        c.innerHTML = '<img src="' + selElmnt.options[j].getAttribute('src') + '">';
        c.setAttribute('value', selElmnt.options[j].getAttribute('value'));
        c.firstElementChild.classList.add(selElmnt.options[j].getAttribute('class'));
        if (x[i].getAttribute('type') == 'buttons') {
            c.setAttribute('onclick', selElmnt.options[j].getAttribute('onclick'));
        }
        c.addEventListener("click", function (e) {
            var i, s, h, p;
            p = this.parentNode.parentNode;
            s = p.getElementsByTagName("select")[0];
            h = this.parentNode.previousSibling;
            if (p.getAttribute('type') != 'buttons') {
                for (i = 0; i < s.length; i++) {
                    if (s.options[i].getAttribute('value') == this.getAttribute('value')) {
                        p.value = s.options[i].getAttribute('value');
                        s.selectedIndex = i;
                        h.firstElementChild.src = this.firstElementChild.src;
                        s.options[i].click();
                        break;
                    }
                }
                try {
                    p.onchange();
                } catch (error) {}
            }
            h.click();
        });
        b.appendChild(c);
    }
    if (ll == 1) {
        a.setAttribute('onclick', selElmnt.options[0].getAttribute('onclick'));
    }
    x[i].appendChild(b);
    a.addEventListener("click", function (e) {
        e.stopPropagation();
        let onlyOpenClass = this.parentElement.getAttribute('only-open-with-class');
        if (onlyOpenClass) {
            if (!this.parentElement.classList.contains(onlyOpenClass)) {
                return;
            }
        }
        closeAllSelect(this);
        this.nextSibling.classList.toggle("select-hide");
    });
}
function closeAllSelect(el) {
    el = el.target || el;
    if (!(el.nodeName == 'CANVAS' || el.classList.contains('select-selected'))) {return;}
    var x, y, i, arrNo = [];
    x = document.getElementsByClassName("select-items");
    y = document.getElementsByClassName("select-selected");
    for (i = 0; i < y.length; i++) {
        if (el == y[i]) {
            arrNo.push(i);
        } else {
            y[i].classList.remove("select-arrow-active");
        }
    }
    for (i = 0; i < x.length; i++) {
        if (arrNo.indexOf(i)) {
            x[i].classList.add("select-hide");
        }
    }
}
document.addEventListener("pointerdown", closeAllSelect);