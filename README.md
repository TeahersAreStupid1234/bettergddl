# BetterGDDL
Chrome extension that improves GDDL with functions such as removing outliers or adjusting tier rounding. 99% made with AI.
## Current Features:
_Since this is in initial release, theres only two main features_
### Changing rounding methods for tiers
GDDL rounds tier ratings using the _five-or-more_ methods, which may be misleading because some people believe a Tier 6.5 is completely different from a Tier 7. This allows you to customize that:

Without rounding settings (or set to GDDL's default 0.5): ![image](https://github.com/user-attachments/assets/249cc0ac-23b6-437a-982b-824cc79a19cd)

With rounding settings (set to 0.75): ![image](https://github.com/user-attachments/assets/09eea6e4-cce2-43b7-af4a-97e322bf42fe)
You can also choose:  
- Floor: Ignores decimals completely. (e.g. 6.99 → 6)  
- Ceiling: Always rounds up if there’s any decimal. (e.g. 6.01 → 7)  
### Excluding outliers for determining tier ratings
Some levels have very big outlier opinions, which can cause severly altered tier ratings ESPECIALLY for levels with low opinion counts. Outliers are determined if the tier rating is not in the range 
> **Mean ± Standard Deviation**.
_More methods of determining outliers may be added in the future._

Hover over the updated rating to see the original rating.

Without excluding outliers: ![image](https://github.com/user-attachments/assets/4ee7806a-6d56-4042-95e1-893270e69895)

Excluding outliers: ![image](https://github.com/user-attachments/assets/2f39fe68-d431-4f21-a515-48b6386edcbc)

_Note that the red marking of outlier opinions on users may be bugged. Please make a pull request or open an issue on any bugs you find._


